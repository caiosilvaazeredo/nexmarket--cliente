import { auth } from './firebase';
import type { PaymentMethod } from './types';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card_online: 'Cartão de crédito (online)',
  card_delivery: 'Cartão na entrega',
  cash_delivery: 'Dinheiro na entrega',
  voucher_delivery: 'Vale-refeição na entrega',
};

export const PAYMENT_SHORT: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card_online: 'Cartão online',
  card_delivery: 'Cartão na entrega',
  cash_delivery: 'Dinheiro',
  voucher_delivery: 'Vale',
};

/** Format a card number as groups of 4 digits while typing. */
export function maskCardNumber(raw: string): string {
  return (raw || '')
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

export function maskExpiry(raw: string): string {
  const d = (raw || '').replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Detect the card brand from the leading digits (display-only). */
export function cardBrand(raw: string): string {
  const n = (raw || '').replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(606282|3841|50)/.test(n)) return 'Elo';
  return 'Cartão';
}

export function last4(raw: string): string {
  const n = (raw || '').replace(/\D/g, '');
  return n.slice(-4);
}

/* ===================== Servidor de pagamentos (Pagar.me) ===================== */
/**
 * Os apps NUNCA falam com a Pagar.me usando a chave secreta: todo pagamento
 * online passa pelo servidor de pagamentos da plataforma (repo
 * nexmarket--Empresa, pasta server/), que valida o token Firebase do usuário
 * e cria os pedidos/cobranças com split para a loja. O único contato direto
 * com a Pagar.me é a tokenização do cartão (chave PÚBLICA, ver
 * `tokenizeCard` abaixo) — o número do cartão nunca passa pelo nosso servidor
 * (RNF10).
 */

export function paymentsApiUrl(): string {
  return (process.env.EXPO_PUBLIC_PAYMENTS_API_URL || '').trim().replace(/\/$/, '');
}

/** Whether real (Pagar.me) payments are configured; otherwise the demo flow runs. */
export function paymentsConfigured(): boolean {
  return paymentsApiUrl().length > 0;
}

async function api<T>(path: string, init?: RequestInit & { query?: Record<string, string> }): Promise<T> {
  const base = paymentsApiUrl();
  if (!base) throw new Error('Servidor de pagamentos não configurado.');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('É necessário estar logado para pagar online.');
  const qs = init?.query ? `?${new URLSearchParams(init.query).toString()}` : '';
  const res = await fetch(`${base}${path}${qs}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.error || `Falha no servidor de pagamentos (${res.status}).`);
    err.status = res.status;
    err.needsReview = res.status === 422;
    throw err;
  }
  return body as T;
}

/* ------------------------ Config pública do gateway ----------------------- */

export interface GatewayPublicConfig {
  publicKey?: string;
  tokenEndpoint?: string;
  currency?: string;
  provider?: string;
  paymentsEnabled?: boolean;
  minOrderBRL?: number;
}

let gwConfig: GatewayPublicConfig | null = null;
let gwConfigAt = 0;

/** GET /config (público, cache 5 min) — chave pública + endpoint de tokenização. */
export async function getGatewayConfig(): Promise<GatewayPublicConfig> {
  const base = paymentsApiUrl();
  if (!base) return {};
  if (gwConfig && Date.now() - gwConfigAt < 5 * 60 * 1000) return gwConfig;
  try {
    const res = await fetch(`${base}/config`);
    gwConfig = res.ok ? await res.json() : {};
  } catch {
    gwConfig = {};
  }
  gwConfigAt = Date.now();
  return gwConfig || {};
}

/* --------------------- Tokenização de cartão (Pagar.me) -------------------- */

export interface CardToken {
  token: string;
  brand: string;
  last4: string;
}

/**
 * Tokeniza o cartão diretamente com a Pagar.me usando a chave PÚBLICA (nunca
 * a secreta) — o número/CVV são enviados apenas para `tokenEndpoint` e o
 * servidor de pagamentos só recebe o token de volta. Sem servidor de
 * pagamentos configurado cai no modo demonstração (não cobra de verdade).
 */
export async function tokenizeCard(card: {
  number: string;
  cvv: string;
  expiry: string; // MM/AA
  holderName: string;
}): Promise<CardToken> {
  const digits = card.number.replace(/\D/g, '');
  if (digits.length < 13) throw new Error('Número de cartão inválido.');
  const [mm, yy] = card.expiry.split('/');
  if (!mm || !yy || mm.length !== 2 || yy.length < 2) throw new Error('Validade do cartão inválida.');

  const { publicKey, tokenEndpoint } = await getGatewayConfig();
  if (!paymentsConfigured() || !publicKey || !tokenEndpoint) {
    // Modo demonstração — nenhuma cobrança real será feita.
    await new Promise((r) => setTimeout(r, 500));
    return { token: `demo_${Math.random().toString(36).slice(2, 14)}`, brand: cardBrand(card.number), last4: last4(card.number) };
  }

  const res = await fetch(`${tokenEndpoint}?appId=${encodeURIComponent(publicKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'card',
      card: {
        number: digits,
        holder_name: card.holderName,
        exp_month: mm,
        exp_year: yy.length === 2 ? `20${yy}` : yy,
        cvv: card.cvv,
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || 'Não foi possível validar o cartão. Confira os dados e tente novamente.');
  }
  return {
    token: body.id,
    brand: body.card?.brand || cardBrand(card.number),
    last4: body.card?.last_four_digits || last4(card.number),
  };
}

/* --------------------------------- Checkout -------------------------------- */

export interface PixInfo {
  qrData: string | null;
  qrImageUrl: string | null;
  expiresAt: string | null;
}

export interface CheckoutResult {
  ok: boolean;
  status: 'paid' | 'failed' | 'pending';
  pagarmeOrderId: string;
  chargeId: string | null;
  amount: number;
  pix?: PixInfo;
}

/**
 * Cobra um pedido (kind='order') ou uma gorjeta avulsa (kind='tip') via
 * Pagar.me. Cartão: `cardToken` (de `tokenizeCard`) ou `cardId` de um cartão
 * salvo. PIX: devolve QR code + copia-e-cola, a confirmação chega por
 * polling em `getPaymentStatus` (o webhook do servidor também concilia).
 */
export function checkout(input: {
  smId: string;
  orderId: string;
  paymentMethod: 'card' | 'pix';
  cardToken?: string;
  cardId?: string;
  installments?: number;
  saveCard?: boolean;
  kind?: 'order' | 'tip';
  amount?: number;
  driverName?: string;
}): Promise<CheckoutResult> {
  return api<CheckoutResult>('/api/payments/checkout', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface PaymentStatus {
  status: 'paid' | 'failed' | 'pending';
  paid: boolean;
  pagarmeOrderId: string;
  chargeId: string | null;
}

export function getPaymentStatus(input: { pagarmeOrderId: string; smId: string; orderId: string }): Promise<PaymentStatus> {
  return api<PaymentStatus>('/api/payments/status', {
    query: { pagarmeOrderId: input.pagarmeOrderId, smId: input.smId, orderId: input.orderId },
  });
}

/* ------------------------ Cartões salvos (1 toque) ------------------------ */

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
}

export async function getSavedMethods(): Promise<SavedCard[]> {
  const res = await api<{ methods: SavedCard[] }>('/api/payments/saved-methods');
  return res.methods || [];
}

export function deleteSavedMethod(id: string): Promise<{ ok: boolean }> {
  return api(`/api/payments/saved-methods/${id}`, { method: 'DELETE' });
}

/* --------------------- Reembolso self-service por item --------------------- */

/** Estorno parcial automático de itens com problema. Erros esperados:
 * `needsReview=true` (acima do teto → vira chamado) e `notOnline=true`
 * (pedido sem pagamento online). */
export async function requestItemRefund(input: {
  smId: string;
  orderId: string;
  amount: number;
  reason: string;
}): Promise<{ ok: boolean; refundId: string; amount: number }> {
  try {
    return await api('/api/payments/item-refund', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (e: any) {
    e.needsReview = e?.status === 422;
    throw e;
  }
}
