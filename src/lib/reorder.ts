import { addToCart } from './cart';
import type { Order, Product, CartOption } from './types';

export { addToCart };

/**
 * Repeat a past order (RF19): re-add every still-available item to the current
 * cart, re-validating against the LIVE product (current price & stock). Items
 * that no longer exist or are out of stock are skipped. Returns how many lines
 * were successfully added.
 */
export function toastReorder(order: Order, liveProducts: Product[]): number {
  let added = 0;
  for (const item of order.items) {
    const product = liveProducts.find((p) => p.id === item.productId);
    if (!product) continue;
    if (product.stock !== undefined && product.stock <= 0) continue;
    const quantity =
      product.stock !== undefined ? Math.min(item.quantity, product.stock) : item.quantity;
    const options: CartOption[] | undefined = item.options;
    const res = addToCart(product, { quantity, options, notes: item.notes });
    if (res.ok) added++;
  }
  return added;
}
