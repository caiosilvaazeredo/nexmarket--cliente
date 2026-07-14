import type { Product, Promotion } from './types';

/**
 * Pricing engine, ported from the loja PublicStorefront and extended to also
 * honor product-level promo prices (Product.inPromo / promoPrice) authored in
 * the loja's PromotionsManager. The cliente app and the web storefront thus
 * compute identical prices.
 */

export interface AppliedPromo {
  source: 'product' | 'rule';
  label: string; // e.g. "-15%" or "OFERTA"
  type?: Promotion['type'];
  value?: number;
}

function isPromoLive(p: { promoEndsAt?: any }): boolean {
  if (!p?.promoEndsAt) return true;
  const end =
    typeof p.promoEndsAt?.toMillis === 'function'
      ? p.promoEndsAt.toMillis()
      : typeof p.promoEndsAt?.seconds === 'number'
        ? p.promoEndsAt.seconds * 1000
        : typeof p.promoEndsAt === 'number'
          ? p.promoEndsAt
          : new Date(p.promoEndsAt).getTime();
  return isNaN(end) ? true : end > Date.now();
}

/** Best rule-based promotion targeting a product (product > subcategory > category). */
export function getRulePromotion(product: Product, promotions: Promotion[]): Promotion | null {
  const applicable = promotions.filter((p) => {
    if (p.couponCode) return false; // coupon promos apply only via the cart
    if (p.targetType === 'product' && p.targetId === product.id) return true;
    if (p.targetType === 'subcategory' && p.targetId === product.subcategory) return true;
    if (p.targetType === 'category' && p.targetId === product.gondolaId) return true;
    return false;
  });
  if (!applicable.length) return null;
  const rank: Record<string, number> = { product: 1, subcategory: 2, category: 3 };
  applicable.sort((a, b) => (rank[a.targetType] ?? 9) - (rank[b.targetType] ?? 9));
  return applicable[0];
}

/** Single-unit effective price for a product (lowest of product promo / rule). */
export function effectiveUnitPrice(product: Product, promotions: Promotion[]): number {
  let price = product.price;

  // Product-level promo (badge "OFERTA" with a fixed promoPrice).
  if (product.inPromo && typeof product.promoPrice === 'number' && isPromoLive(product)) {
    price = Math.min(price, product.promoPrice);
  }

  const rule = getRulePromotion(product, promotions);
  if (rule) {
    if (rule.type === 'percentage') price = Math.min(price, product.price * (1 - rule.value / 100));
    else if (rule.type === 'fixed') price = Math.min(price, Math.max(0, product.price - rule.value));
    // 'quantity' promos only change the line total, handled in lineTotal.
  }
  return Math.max(0, price);
}

/** Total for a cart line, applying quantity-based promotions when present. */
export function lineTotal(product: Product, qty: number, promotions: Promotion[]): number {
  const rule = getRulePromotion(product, promotions);
  if (rule && rule.type === 'quantity' && rule.requiredQuantity) {
    const sets = Math.floor(qty / rule.requiredQuantity);
    const remainder = qty % rule.requiredQuantity;
    return sets * rule.value + remainder * product.price;
  }
  return effectiveUnitPrice(product, promotions) * qty;
}

/** Whether a product currently has any discount. */
export function hasDiscount(product: Product, promotions: Promotion[]): boolean {
  return effectiveUnitPrice(product, promotions) < product.price - 0.001 || !!getRulePromotion(product, promotions);
}

/** Badge text for a discounted product, or null. */
export function promoBadge(product: Product, promotions: Promotion[]): AppliedPromo | null {
  const rule = getRulePromotion(product, promotions);
  if (rule) {
    if (rule.type === 'percentage') return { source: 'rule', label: `-${rule.value}%`, type: rule.type, value: rule.value };
    return { source: 'rule', label: 'OFERTA', type: rule.type, value: rule.value };
  }
  if (product.inPromo && typeof product.promoPrice === 'number' && isPromoLive(product) && product.promoPrice < product.price) {
    const pct = Math.round((1 - product.promoPrice / product.price) * 100);
    return { source: 'product', label: pct > 0 ? `-${pct}%` : 'OFERTA' };
  }
  return null;
}

/* ----------------------------- Coupons ----------------------------- */

export interface CouponResult {
  ok: boolean;
  code: string;
  discount: number; // absolute R$ off the subtotal (includes freed shipping)
  freeShipping: boolean;
  message: string;
}

export interface CouponContext {
  /** True when this is the customer's first order (for firstOrderOnly coupons). */
  isFirstOrder?: boolean;
  /** Current delivery fee, used by free_shipping coupons. */
  deliveryFee?: number;
}

/**
 * Validate & apply a coupon code against the promotions list + cart subtotal.
 * Coupon promotions are Promotion docs that carry a `couponCode`. Supports
 * percentage / fixed / free_shipping types plus minSubtotal, maxDiscount and
 * firstOrderOnly constraints (RF12 + alternative flows).
 */
export function applyCoupon(
  rawCode: string,
  subtotal: number,
  promotions: Promotion[],
  ctx: CouponContext = {},
): CouponResult {
  const code = rawCode.trim().toUpperCase();
  const fail = (message: string): CouponResult => ({ ok: false, code, discount: 0, freeShipping: false, message });

  if (!code) return fail('Digite um cupom.');

  const promo = promotions.find((p) => (p.couponCode || '').toUpperCase() === code);
  if (!promo) return fail('Cupom inválido ou expirado.');

  if (promo.firstOrderOnly && ctx.isFirstOrder === false) {
    return fail('Este cupom é exclusivo para novos clientes.');
  }

  // minSubtotal (or legacy requiredQuantity) gates the coupon.
  const min = promo.minSubtotal ?? promo.requiredQuantity ?? 0;
  if (min > 0 && subtotal < min) {
    const falta = (min - subtotal).toFixed(2).replace('.', ',');
    return fail(`Adicione mais R$ ${falta} para usar este cupom.`);
  }

  const deliveryFee = ctx.deliveryFee || 0;
  let discount = 0;
  let freeShipping = false;
  let label = '';

  if (promo.type === 'free_shipping') {
    freeShipping = true;
    discount = deliveryFee;
    label = 'frete grátis';
  } else if (promo.type === 'percentage') {
    discount = subtotal * (promo.value / 100);
    label = `${promo.value}% de desconto`;
  } else {
    discount = promo.value;
    label = `R$ ${promo.value.toFixed(2).replace('.', ',')} de desconto`;
  }

  if (promo.maxDiscount && promo.type !== 'free_shipping') {
    discount = Math.min(discount, promo.maxDiscount);
  }
  discount = Math.max(0, Math.min(discount, subtotal + deliveryFee));

  return { ok: true, code, discount, freeShipping, message: `Cupom aplicado: ${label}!` };
}
