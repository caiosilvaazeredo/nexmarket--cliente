/**
 * Carteira digital + cashback (estilo iFood/99).
 *
 * O percentual de cashback é definido pela plataforma no painel Empresa e
 * publicado em `platformConfig/public` (leitura aberta). Quando um pedido é
 * entregue, o app credita `subtotal × pct` na carteira do cliente — a marcação
 * `cashbackCredited` no pedido (via transação) garante crédito único. O saldo
 * pode ser usado como desconto no checkout.
 */
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Order } from './types';

export interface PublicPlatformConfig {
  cashbackPct?: number;
}

let cachedConfig: PublicPlatformConfig | null = null;
let cachedAt = 0;

/** Config pública da plataforma (cache de 5 min). */
export async function getPublicConfig(): Promise<PublicPlatformConfig> {
  if (cachedConfig && Date.now() - cachedAt < 5 * 60 * 1000) return cachedConfig;
  try {
    const snap = await getDoc(doc(db, 'platformConfig', 'public'));
    cachedConfig = snap.exists() ? (snap.data() as PublicPlatformConfig) : {};
  } catch {
    cachedConfig = {};
  }
  cachedAt = Date.now();
  return cachedConfig;
}

const round2 = (v: number) => Number(v.toFixed(2));

/**
 * Credita o cashback de pedidos entregues ainda não creditados.
 * Retorna o total creditado (0 se nada a fazer).
 */
export async function creditCashbackForOrders(uid: string, orders: Order[]): Promise<number> {
  const { cashbackPct } = await getPublicConfig();
  const pct = Number(cashbackPct || 0);
  if (!(pct > 0)) return 0;

  let total = 0;
  for (const o of orders) {
    const delivered = o.status === 'delivered' || o.deliveryStatus === 'delivered';
    if (!delivered || o.cashbackCredited || o.customerId !== uid) continue;
    const base = o.subtotal ?? Math.max(0, (o.total || 0) - (o.deliveryFee || 0) - (o.tip || 0));
    const amount = round2((base * pct) / 100);
    if (!(amount > 0)) continue;

    const ref = doc(db, `supermarkets/${o.supermarketId}/orders/${o.id}`);
    try {
      // Transação: só credita quem realmente virou o flag (evita duplo crédito).
      const won = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists() || (snap.data() as any).cashbackCredited) return false;
        tx.update(ref, { cashbackCredited: true, updatedAt: serverTimestamp() });
        return true;
      });
      if (won) {
        await updateDoc(doc(db, `customers/${uid}`), {
          walletBalance: increment(amount),
          updatedAt: serverTimestamp(),
        });
        total += amount;
      }
    } catch {
      // tenta de novo na próxima sincronização
    }
  }
  return round2(total);
}

/** Debita o saldo usado como desconto num pedido. */
export async function spendWallet(uid: string, amount: number): Promise<void> {
  if (!(amount > 0)) return;
  await updateDoc(doc(db, `customers/${uid}`), {
    walletBalance: increment(-Math.abs(amount)),
    updatedAt: serverTimestamp(),
  });
}
