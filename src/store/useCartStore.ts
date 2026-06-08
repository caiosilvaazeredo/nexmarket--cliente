import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartLine, Product } from '../lib/types';

const KEY = '@nex_cliente_cart_v1';

interface CartState {
  smId: string | null;
  lines: CartLine[];
  couponCode: string | null;
  couponDiscount: number;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  /** Add (delta>0) or remove (delta<0) units. Cart is scoped to one store. */
  addItem: (product: Product, delta: number) => void;
  /** Same as addItem but returns false if it would mix two stores. */
  tryAddItem: (product: Product, delta: number) => boolean;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  quantityOf: (productId: string) => number;
  totalCount: () => number;
  setCoupon: (code: string | null, discount: number) => void;
  clear: () => void;
  replaceWith: (product: Product, quantity: number) => void;
}

function persist(state: Pick<CartState, 'smId' | 'lines' | 'couponCode' | 'couponDiscount'>) {
  AsyncStorage.setItem(
    KEY,
    JSON.stringify({
      smId: state.smId,
      lines: state.lines,
      couponCode: state.couponCode,
      couponDiscount: state.couponDiscount,
    }),
  ).catch(() => {});
}

export const useCartStore = create<CartState>((set, get) => ({
  smId: null,
  lines: [],
  couponCode: null,
  couponDiscount: 0,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          smId: data.smId ?? null,
          lines: data.lines ?? [],
          couponCode: data.couponCode ?? null,
          couponDiscount: data.couponDiscount ?? 0,
          hydrated: true,
        });
        return;
      }
    } catch {}
    set({ hydrated: true });
  },

  addItem: (product, delta) => {
    const { lines, smId } = get();
    const nextSmId = lines.length === 0 ? product.supermarketId : smId;
    const existing = lines.find((l) => l.product.id === product.id);
    let nextLines: CartLine[];
    if (existing) {
      const q = existing.quantity + delta;
      nextLines = q <= 0 ? lines.filter((l) => l.product.id !== product.id) : lines.map((l) => (l.product.id === product.id ? { ...l, quantity: q, product } : l));
    } else if (delta > 0) {
      nextLines = [...lines, { product, quantity: delta }];
    } else {
      nextLines = lines;
    }
    const finalSmId = nextLines.length === 0 ? null : nextSmId;
    // Clearing the coupon if the cart contents change keeps totals honest.
    set({ lines: nextLines, smId: finalSmId, couponCode: null, couponDiscount: 0 });
    persist({ lines: nextLines, smId: finalSmId, couponCode: null, couponDiscount: 0 });
  },

  tryAddItem: (product, delta) => {
    const { lines, smId } = get();
    if (lines.length > 0 && smId && product.supermarketId !== smId) return false;
    get().addItem(product, delta);
    return true;
  },

  replaceWith: (product, quantity) => {
    const lines: CartLine[] = [{ product, quantity }];
    set({ lines, smId: product.supermarketId, couponCode: null, couponDiscount: 0 });
    persist({ lines, smId: product.supermarketId, couponCode: null, couponDiscount: 0 });
  },

  setQuantity: (productId, quantity) => {
    const { lines } = get();
    const nextLines = quantity <= 0 ? lines.filter((l) => l.product.id !== productId) : lines.map((l) => (l.product.id === productId ? { ...l, quantity } : l));
    const finalSmId = nextLines.length === 0 ? null : get().smId;
    set({ lines: nextLines, smId: finalSmId, couponCode: null, couponDiscount: 0 });
    persist({ lines: nextLines, smId: finalSmId, couponCode: null, couponDiscount: 0 });
  },

  removeItem: (productId) => {
    const nextLines = get().lines.filter((l) => l.product.id !== productId);
    const finalSmId = nextLines.length === 0 ? null : get().smId;
    set({ lines: nextLines, smId: finalSmId, couponCode: null, couponDiscount: 0 });
    persist({ lines: nextLines, smId: finalSmId, couponCode: null, couponDiscount: 0 });
  },

  quantityOf: (productId) => get().lines.find((l) => l.product.id === productId)?.quantity || 0,

  totalCount: () => get().lines.reduce((a, l) => a + l.quantity, 0),

  setCoupon: (couponCode, couponDiscount) => {
    set({ couponCode, couponDiscount });
    persist({ lines: get().lines, smId: get().smId, couponCode, couponDiscount });
  },

  clear: () => {
    set({ lines: [], smId: null, couponCode: null, couponDiscount: 0 });
    persist({ lines: [], smId: null, couponCode: null, couponDiscount: 0 });
  },
}));
