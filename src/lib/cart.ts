import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import type { CartItem, CartOption, Product, DeliveryConfig } from './types';

/**
 * Cart engine (RF10–RF13). The cart lives in the Zustand store and is mirrored
 * to AsyncStorage so it survives app restarts and connection drops (offline
 * resilience). Every mutation goes through here so persistence is automatic.
 */

const CART_KEY = '@nex_cart_v1';
const COUPON_KEY = '@nex_coupon_v1';

function lineKey(productId: string, options?: CartOption[]): string {
  if (!options?.length) return productId;
  const sig = options
    .map((o) => `${o.groupId}:${o.choiceId}`)
    .sort()
    .join('|');
  return `${productId}#${sig}`;
}

async function persist(items: CartItem[]) {
  try {
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {}
}

export async function hydrateCart() {
  try {
    const raw = await AsyncStorage.getItem(CART_KEY);
    if (raw) useStore.getState().setCart(JSON.parse(raw));
    const coupon = await AsyncStorage.getItem(COUPON_KEY);
    if (coupon) useStore.getState().setCoupon(coupon);
  } catch {}
}

function commit(items: CartItem[]) {
  useStore.getState().setCart(items);
  persist(items);
}

export function addToCart(
  product: Product,
  opts?: { quantity?: number; options?: CartOption[]; notes?: string },
): { ok: boolean; reason?: string } {
  const quantity = opts?.quantity ?? 1;
  const options = opts?.options;
  const cart = useStore.getState().cart;
  const key = lineKey(product.id, options);
  const optionDelta = (options || []).reduce((s, o) => s + (o.priceDelta || 0), 0);
  const unitPrice = Number((product.price + optionDelta).toFixed(2));

  const existing = cart.find((i) => i.key === key);
  const nextQty = (existing?.quantity || 0) + quantity;

  // Respect stock limit (RF: max stock guard).
  if (product.stock !== undefined && nextQty > product.stock) {
    return { ok: false, reason: 'stock' };
  }

  let items: CartItem[];
  if (existing) {
    items = cart.map((i) => (i.key === key ? { ...i, quantity: nextQty } : i));
  } else {
    const item: CartItem = {
      key,
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      unit: product.unit,
      price: unitPrice,
      basePrice: product.price,
      originalPrice: product.originalPrice,
      quantity,
      options,
      notes: opts?.notes,
      stock: product.stock,
      ageRestricted: product.ageRestricted,
    };
    items = [...cart, item];
  }
  commit(items);
  return { ok: true };
}

export function setQuantity(key: string, quantity: number): { ok: boolean; reason?: string } {
  const cart = useStore.getState().cart;
  const item = cart.find((i) => i.key === key);
  if (!item) return { ok: false };
  if (quantity <= 0) {
    commit(cart.filter((i) => i.key !== key));
    return { ok: true };
  }
  if (item.stock !== undefined && quantity > item.stock) {
    return { ok: false, reason: 'stock' };
  }
  commit(cart.map((i) => (i.key === key ? { ...i, quantity } : i)));
  return { ok: true };
}

export const increment = (key: string) => {
  const item = useStore.getState().cart.find((i) => i.key === key);
  return setQuantity(key, (item?.quantity || 0) + 1);
};
export const decrement = (key: string) => {
  const item = useStore.getState().cart.find((i) => i.key === key);
  return setQuantity(key, (item?.quantity || 0) - 1);
};

export function removeFromCart(key: string) {
  commit(useStore.getState().cart.filter((i) => i.key !== key));
}

export function clearCart() {
  commit([]);
  setCoupon(null);
}

export function setCoupon(code: string | null) {
  useStore.getState().setCoupon(code);
  if (code) AsyncStorage.setItem(COUPON_KEY, code).catch(() => {});
  else AsyncStorage.removeItem(COUPON_KEY).catch(() => {});
}

/** Quantity of a given product already in the cart (across option variants). */
export function quantityInCart(productId: string): number {
  return useStore
    .getState()
    .cart.filter((i) => i.productId === productId)
    .reduce((n, i) => n + i.quantity, 0);
}

/* ----------------------------- Totals ----------------------------- */

export interface CartTotals {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  freeShipping: boolean;
  remainingForFreeShipping: number;
  remainingForMinOrder: number;
}

export function computeTotals(params: {
  items: CartItem[];
  config: DeliveryConfig | null;
  method: 'delivery' | 'pickup';
  distanceKm?: number;
  discount?: number;
  freeShippingCoupon?: boolean;
  minOrder?: number;
}): CartTotals {
  const { items, config, method, distanceKm, discount = 0, freeShippingCoupon, minOrder = 0 } = params;
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  let deliveryFee = 0;
  if (method === 'delivery' && config) {
    const base = config.baseFee ?? 0;
    const perKm = config.perKm ?? 0;
    deliveryFee = Number((base + perKm * (distanceKm ?? 0)).toFixed(2));
  }

  const freeMin = config?.freeShippingMinimum;
  const freeShipping =
    freeShippingCoupon || (freeMin !== undefined && subtotal >= freeMin && method === 'delivery');
  if (freeShipping) deliveryFee = 0;

  const remainingForFreeShipping =
    freeMin && subtotal < freeMin && method === 'delivery' ? Number((freeMin - subtotal).toFixed(2)) : 0;
  const remainingForMinOrder =
    minOrder && subtotal < minOrder ? Number((minOrder - subtotal).toFixed(2)) : 0;

  const total = Math.max(0, Number((subtotal + deliveryFee - discount).toFixed(2)));
  return {
    subtotal: Number(subtotal.toFixed(2)),
    deliveryFee,
    discount: Number(discount.toFixed(2)),
    total,
    freeShipping,
    remainingForFreeShipping,
    remainingForMinOrder,
  };
}
