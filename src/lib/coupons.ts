import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Coupon } from './types';
import { isDemoMode } from './catalog';
import { DEMO_COUPONS } from './demoData';
import { toDate } from './format';

/**
 * Coupon validation (RF12). Coupons are read from
 * /supermarkets/{smId}/coupons/{CODE} (uppercased code as the doc id) and
 * owned by the loja app. We validate locally for instant feedback; the store
 * re-validates server-side when the order is confirmed.
 */

export interface CouponResult {
  ok: boolean;
  coupon?: Coupon;
  discount?: number;
  freeShipping?: boolean;
  error?: string;
}

export async function fetchCoupon(smId: string, code: string): Promise<Coupon | null> {
  const upper = code.trim().toUpperCase();
  if (!upper) return null;
  if (isDemoMode()) {
    return (DEMO_COUPONS.find((c) => c.code === upper) as Coupon) || null;
  }
  try {
    const snap = await getDoc(doc(db, `supermarkets/${smId}/coupons/${upper}`));
    if (snap.exists()) return { code: upper, ...(snap.data() as any) } as Coupon;
    // Some stores keep a flat /coupons collection — try that too.
    const flat = await getDoc(doc(db, `coupons/${upper}`));
    if (flat.exists()) return { code: upper, ...(flat.data() as any) } as Coupon;
  } catch (e) {
    console.warn('fetchCoupon failed', e);
  }
  return null;
}

export function validateCoupon(
  coupon: Coupon | null,
  subtotal: number,
  isFirstOrder: boolean,
): CouponResult {
  if (!coupon) return { ok: false, error: 'Cupom não encontrado.' };
  if (coupon.active === false) return { ok: false, error: 'Este cupom não está mais ativo.' };

  const exp = toDate(coupon.expiresAt);
  if (exp && exp.getTime() < Date.now()) {
    return { ok: false, error: 'Este cupom expirou.' };
  }
  if (coupon.firstOrderOnly && !isFirstOrder) {
    return { ok: false, error: 'Cupom exclusivo para a primeira compra.' };
  }
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    const missing = (coupon.minSubtotal - subtotal).toFixed(2).replace('.', ',');
    return { ok: false, error: `Adicione mais R$ ${missing} para usar este cupom.` };
  }

  if (coupon.type === 'free_shipping') {
    return { ok: true, coupon, discount: 0, freeShipping: true };
  }
  let discount =
    coupon.type === 'percent'
      ? (subtotal * coupon.value) / 100
      : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, subtotal);
  return { ok: true, coupon, discount: Number(discount.toFixed(2)) };
}

export async function applyCoupon(
  smId: string,
  code: string,
  subtotal: number,
  isFirstOrder: boolean,
): Promise<CouponResult> {
  const coupon = await fetchCoupon(smId, code);
  return validateCoupon(coupon, subtotal, isFirstOrder);
}
