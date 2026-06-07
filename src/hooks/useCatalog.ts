import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useStore } from '../store/useStore';
import { subscribeProducts, subscribeCategories } from '../lib/catalog';
import type { Product, Category } from '../lib/types';

/**
 * Single shared catalog subscription. The first mounted consumer starts the
 * real-time listeners for the active store; all consumers read the same cache,
 * so stock/price updates propagate everywhere instantly (RNF06) without
 * duplicate Firestore listeners.
 */
interface CatalogState {
  products: Product[];
  categories: Category[];
  loaded: boolean;
  setProducts: (p: Product[]) => void;
  setCategories: (c: Category[]) => void;
}

const useCatalogStore = create<CatalogState>((set) => ({
  products: [],
  categories: [],
  loaded: false,
  setProducts: (products) => set({ products, loaded: true }),
  setCategories: (categories) => set({ categories }),
}));

let started = '';

export function useCatalog() {
  const smId = useStore((s) => s.supermarket?.id);
  const products = useCatalogStore((s) => s.products);
  const categories = useCatalogStore((s) => s.categories);
  const loaded = useCatalogStore((s) => s.loaded);

  useEffect(() => {
    if (!smId || started === smId) return;
    started = smId;
    const unsubP = subscribeProducts(smId, useCatalogStore.getState().setProducts);
    const unsubC = subscribeCategories(smId, useCatalogStore.getState().setCategories);
    return () => {
      unsubP();
      unsubC();
      started = '';
    };
  }, [smId]);

  return { products, categories, loaded };
}

export function useProduct(id?: string) {
  const { products } = useCatalog();
  const [fallback, setFallback] = useState<Product | null>(null);
  const fromCache = products.find((p) => p.id === id) || null;
  return fromCache || fallback;
}
