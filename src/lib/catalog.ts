import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Supermarket,
  DeliveryConfig,
  Category,
  Product,
  Branding,
} from './types';
import { DEMO_STORE, DEMO_CATEGORIES, DEMO_PRODUCTS, DEMO_DELIVERY } from './demoData';

/**
 * Catalog reads (RF05–RF09). The customer app only ever READS the catalog;
 * products/categories/branding are owned by the loja app and protected by
 * Security Rules (RNF11). Real-time listeners keep stock & prices fresh
 * almost instantly (RNF06).
 *
 * When the resolved store has no catalog yet (fresh project / test mode) we
 * fall back to a bundled demo catalog so the app is fully explorable without
 * touching the database — mirroring the entregador "Quero apenas testar" mode.
 */

let demoMode = false;
export const isDemoMode = () => demoMode;

/* ----------------------------- Supermarket ----------------------------- */

/**
 * Resolve which store this app instance serves. Strategy:
 *  1) an explicit env/extra `supermarketId` (single-tenant white-label build), else
 *  2) the first `active` supermarket in the collection.
 * Returns the demo store if none is found.
 */
export async function resolveSupermarket(preferredId?: string): Promise<Supermarket> {
  try {
    if (preferredId) {
      const snap = await getDoc(doc(db, `supermarkets/${preferredId}`));
      if (snap.exists()) return mapStore(preferredId, snap.data());
    }
    const q = query(collection(db, 'supermarkets'), where('active', '==', true), limit(1));
    const res = await getDocs(q);
    if (!res.empty) {
      const d = res.docs[0];
      return mapStore(d.id, d.data());
    }
    // Fallback: any supermarket at all.
    const any = await getDocs(query(collection(db, 'supermarkets'), limit(1)));
    if (!any.empty) {
      const d = any.docs[0];
      return mapStore(d.id, d.data());
    }
  } catch (e) {
    console.warn('resolveSupermarket failed, using demo store', e);
  }
  demoMode = true;
  return DEMO_STORE;
}

function mapStore(id: string, data: any): Supermarket {
  const branding: Branding | undefined = data.branding || {
    primaryColor: data.primaryColor,
    appName: data.name,
    logoUrl: data.logoUrl,
  };
  return {
    id,
    name: data.name || 'Loja',
    logoUrl: data.logoUrl,
    bannerUrl: data.bannerUrl,
    description: data.description,
    branding,
    location: data.location || null,
    address: data.address,
    isOpen: data.isOpen ?? true,
    minOrder: data.minOrder ?? 0,
    rating: data.rating,
    whatsapp: data.whatsapp,
    active: data.active ?? true,
  };
}

export function subscribeSupermarket(smId: string, cb: (s: Supermarket) => void) {
  if (demoMode) {
    cb(DEMO_STORE);
    return () => {};
  }
  return onSnapshot(
    doc(db, `supermarkets/${smId}`),
    (snap) => {
      if (snap.exists()) cb(mapStore(smId, snap.data()));
    },
    (err) => console.warn('subscribeSupermarket error', err),
  );
}

export async function getDeliveryConfig(smId: string): Promise<DeliveryConfig> {
  if (demoMode) return DEMO_DELIVERY;
  try {
    const snap = await getDoc(doc(db, `supermarkets/${smId}/deliveryConfig/main`));
    if (snap.exists()) {
      const d = snap.data() as any;
      return {
        deliveryEnabled: d.deliveryEnabled ?? true,
        pickupEnabled: d.pickupEnabled ?? true,
        baseFee: d.baseFee ?? 5,
        perKm: d.perKm ?? 1.5,
        freeShippingMinimum: d.freeShippingMinimum,
        maxRadiusKm: d.maxRadiusKm ?? 10,
        estimatedMinutes: d.estimatedMinutes ?? 40,
        scheduleEnabled: d.scheduleEnabled ?? false,
        scheduleSlots: d.scheduleSlots || [],
      };
    }
  } catch (e) {
    console.warn('getDeliveryConfig failed', e);
  }
  return DEMO_DELIVERY;
}

/* ----------------------------- Categories ----------------------------- */

export function subscribeCategories(smId: string, cb: (c: Category[]) => void) {
  if (demoMode) {
    cb(DEMO_CATEGORIES);
    return () => {};
  }
  const q = query(collection(db, `supermarkets/${smId}/categories`));
  return onSnapshot(
    q,
    (snap) => {
      const cats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Category));
      cats.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      cb(cats.length ? cats : DEMO_CATEGORIES);
    },
    (err) => {
      console.warn('subscribeCategories error', err);
      cb(DEMO_CATEGORIES);
    },
  );
}

/* ----------------------------- Products ----------------------------- */

function mapProduct(smId: string, id: string, data: any): Product {
  const price = Number(data.price) || 0;
  const original = data.originalPrice ? Number(data.originalPrice) : undefined;
  const discountPercent =
    data.discountPercent ??
    (original && original > price ? Math.round((1 - price / original) * 100) : undefined);
  return {
    id,
    supermarketId: smId,
    name: data.name || 'Produto',
    description: data.description,
    imageUrl: data.imageUrl || (data.images?.[0] ?? undefined),
    images: data.images,
    price,
    originalPrice: original,
    discountPercent,
    categoryId: data.categoryId,
    categoryName: data.categoryName,
    brand: data.brand,
    unit: data.unit || 'un',
    stock: data.stock,
    active: data.active ?? true,
    tags: data.tags || [],
    barcode: data.barcode,
    nutrition: data.nutrition,
    ageRestricted: data.ageRestricted ?? false,
    options: data.options || [],
    rating: data.rating,
    ratingCount: data.ratingCount,
  };
}

/** Real-time catalog listener — reflects stock/price changes instantly (RNF06). */
export function subscribeProducts(smId: string, cb: (p: Product[]) => void) {
  if (demoMode) {
    cb(DEMO_PRODUCTS);
    return () => {};
  }
  const q = query(collection(db, `supermarkets/${smId}/products`), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const products = snap.docs.map((d) => mapProduct(smId, d.id, d.data()));
      cb(products.length ? products : DEMO_PRODUCTS);
    },
    (err) => {
      console.warn('subscribeProducts error', err);
      cb(DEMO_PRODUCTS);
    },
  );
}

export async function getProduct(smId: string, id: string): Promise<Product | null> {
  if (demoMode) return DEMO_PRODUCTS.find((p) => p.id === id) || null;
  try {
    const snap = await getDoc(doc(db, `supermarkets/${smId}/products/${id}`));
    if (snap.exists()) return mapProduct(smId, id, snap.data());
  } catch (e) {
    console.warn('getProduct failed', e);
  }
  return DEMO_PRODUCTS.find((p) => p.id === id) || null;
}

/* ----------------------------- Helpers ----------------------------- */

export function groupByCategory(products: Product[], categories: Category[]) {
  const byId = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.categoryId || 'outros';
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key)!.push(p);
  }
  return categories
    .map((c) => ({ category: c, products: byId.get(c.id) || [] }))
    .filter((g) => g.products.length > 0);
}

export const onSale = (p: Product) =>
  !!p.originalPrice && p.originalPrice > p.price;

export const inStock = (p: Product) => p.stock === undefined || p.stock > 0;
