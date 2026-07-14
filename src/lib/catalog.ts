import {
  collection,
  doc,
  onSnapshot,
  query,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Supermarket,
  Gondola,
  Product,
  Promotion,
  DeliveryConfig,
  StoreInfo,
  AppConfig,
} from './types';

/* ----------------------------- Supermarkets ----------------------------- */

export function subscribeSupermarkets(cb: (list: Supermarket[]) => void) {
  return onSnapshot(
    query(collection(db, 'supermarkets')),
    (snap) => {
      const list: Supermarket[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      cb(list);
    },
    (err) => {
      console.warn('subscribeSupermarkets error', err);
      cb([]);
    },
  );
}

export async function getSupermarket(smId: string): Promise<Supermarket | null> {
  try {
    const d = await getDoc(doc(db, 'supermarkets', smId));
    return d.exists() ? ({ id: d.id, ...(d.data() as any) } as Supermarket) : null;
  } catch {
    return null;
  }
}

export function subscribeSupermarket(smId: string, cb: (sm: Supermarket | null) => void) {
  return onSnapshot(
    doc(db, 'supermarkets', smId),
    (d) => cb(d.exists() ? ({ id: d.id, ...(d.data() as any) } as Supermarket) : null),
    (err) => {
      console.warn('subscribeSupermarket error', err);
      cb(null);
    },
  );
}

/* ----------------------------- Gondolas ----------------------------- */

export function subscribeGondolas(smId: string, cb: (list: Gondola[]) => void) {
  return onSnapshot(
    query(collection(db, `supermarkets/${smId}/gondolas`)),
    (snap) => {
      const list: Gondola[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      cb(list);
    },
    (err) => {
      console.warn('subscribeGondolas error', err);
      cb([]);
    },
  );
}

/* ----------------------------- Products ----------------------------- */
// Real-time so stock & price updates reflect almost instantly (RNF06).

export function subscribeProducts(smId: string, cb: (list: Product[]) => void) {
  return onSnapshot(
    query(collection(db, `supermarkets/${smId}/products`)),
    (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      cb(list);
    },
    (err) => {
      console.warn('subscribeProducts error', err);
      cb([]);
    },
  );
}

/* ----------------------------- Promotions ----------------------------- */

export function subscribePromotions(smId: string, cb: (list: Promotion[]) => void) {
  return onSnapshot(
    query(collection(db, `supermarkets/${smId}/promotions`)),
    (snap) => {
      const list: Promotion[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      cb(list.filter((p) => p.active !== false));
    },
    (err) => {
      console.warn('subscribePromotions error', err);
      cb([]);
    },
  );
}

/* ----------------------------- Store config ----------------------------- */

export function subscribeDeliveryConfig(smId: string, cb: (c: DeliveryConfig | null) => void) {
  return onSnapshot(
    doc(db, `supermarkets/${smId}/deliveryConfig/main`),
    (d) => cb(d.exists() ? (d.data() as DeliveryConfig) : null),
    () => cb(null),
  );
}

export function subscribeStoreInfo(smId: string, cb: (c: StoreInfo | null) => void) {
  return onSnapshot(
    doc(db, `supermarkets/${smId}/settings/storeInfo`),
    (d) => cb(d.exists() ? (d.data() as StoreInfo) : null),
    () => cb(null),
  );
}

export function subscribeAppConfig(smId: string, cb: (c: AppConfig | null) => void) {
  return onSnapshot(
    doc(db, `supermarkets/${smId}/storefront/appConfig`),
    (d) => {
      if (!d.exists()) return cb(null);
      try {
        cb(JSON.parse((d.data() as any).configJson) as AppConfig);
      } catch {
        cb(null);
      }
    },
    () => cb(null),
  );
}

export function subscribeStorefrontConfig(smId: string, cb: (c: any | null) => void) {
  return onSnapshot(
    doc(db, `supermarkets/${smId}/storefront/config`),
    (d) => {
      if (!d.exists()) return cb(null);
      try {
        cb(JSON.parse((d.data() as any).configJson));
      } catch {
        cb(null);
      }
    },
    () => cb(null),
  );
}

/**
 * Available stock for a product. The loja catalog writes `stockQuantity`; we
 * also accept a legacy `stock` field. Returns `undefined` when the store does
 * not track stock for this item (treated as always available).
 */
export function availableStock(p: Product): number | undefined {
  if (typeof p.stockQuantity === 'number') return p.stockQuantity;
  if (typeof p.stock === 'number') return p.stock;
  return undefined;
}

/** One-shot read of opening hours to decide if a store is currently open. */
export async function getStoreInfoOnce(smId: string): Promise<StoreInfo | null> {
  try {
    const d = await getDoc(doc(db, `supermarkets/${smId}/settings/storeInfo`));
    return d.exists() ? (d.data() as StoreInfo) : null;
  } catch {
    return null;
  }
}
