/**
 * Busca por item em TODAS as lojas da plataforma (estilo iFood Mercado):
 * "leite" → em quais lojas tem, por quanto. Usa uma consulta collection-group
 * em `products` (leitura pública) e agrupa por supermercado, ordenando pelo
 * menor preço encontrado. Para catálogos muito grandes o roadmap prevê um
 * índice de busca dedicado (Algolia/Typesense).
 */
import { collectionGroup, getDocs, getDoc, doc, limit, query } from 'firebase/firestore';
import { db } from './firebase';
import { normalize } from './search';
import type { Product } from './types';

export interface CrossStoreProduct extends Product {
  smId: string;
}

export interface StoreHits {
  smId: string;
  storeName: string;
  storeLogoUrl?: string;
  products: CrossStoreProduct[];
  bestPrice: number;
}

const storeNameCache = new Map<string, { name: string; logoUrl?: string }>();

async function storeMeta(smId: string): Promise<{ name: string; logoUrl?: string }> {
  if (storeNameCache.has(smId)) return storeNameCache.get(smId)!;
  let meta = { name: 'Loja', logoUrl: undefined as string | undefined };
  try {
    const snap = await getDoc(doc(db, `supermarkets/${smId}`));
    if (snap.exists()) {
      const d = snap.data() as any;
      meta = { name: d.name || 'Loja', logoUrl: d.logoUrl || undefined };
    }
  } catch {
    // mantém o fallback
  }
  storeNameCache.set(smId, meta);
  return meta;
}

/** Busca `term` em todas as lojas; retorna lojas ordenadas pelo menor preço. */
export async function searchAllStores(term: string, max = 600): Promise<StoreHits[]> {
  const q = normalize(term.trim());
  if (q.length < 2) return [];

  const snap = await getDocs(query(collectionGroup(db, 'products'), limit(max)));
  const byStore = new Map<string, CrossStoreProduct[]>();

  snap.docs.forEach((d) => {
    const data = d.data() as any;
    if (data.active === false) return;
    if (!normalize(String(data.name || '')).includes(q)) return;
    const smId = d.ref.parent.parent?.id;
    if (!smId) return;
    const list = byStore.get(smId) || [];
    list.push({ id: d.id, smId, ...data } as CrossStoreProduct);
    byStore.set(smId, list);
  });

  const hits: StoreHits[] = [];
  for (const [smId, products] of byStore) {
    products.sort((a, b) => (a.price || 0) - (b.price || 0));
    const meta = await storeMeta(smId);
    hits.push({
      smId,
      storeName: meta.name,
      storeLogoUrl: meta.logoUrl,
      products: products.slice(0, 6),
      bestPrice: products[0]?.price || 0,
    });
  }
  hits.sort((a, b) => a.bestPrice - b.bestPrice);
  return hits;
}
