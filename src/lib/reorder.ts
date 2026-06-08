import type { Order, Product } from './types';
import { availableStock } from './catalog';

export interface ReorderResult {
  lines: { product: Product; quantity: number }[];
  /** Names of items skipped because they are currently out of stock. */
  unavailable: string[];
  /** True when some quantities were capped to the available stock. */
  capped: boolean;
}

/**
 * Build the cart lines to re-add from a past order (RF19), revalidating
 * against the live catalog: prefer the current product doc (fresh price/stock),
 * cap quantities to available stock, and skip items that are now out of stock.
 * Items that were missing (and not substituted) in the original order are not
 * carried over.
 */
export function buildReorderLines(order: Order, currentProducts: Product[]): ReorderResult {
  const lines: { product: Product; quantity: number }[] = [];
  const unavailable: string[] = [];
  let capped = false;

  (order.items || []).forEach((it) => {
    if (it.missing && !it.substituted) return; // wasn't delivered last time
    const live = currentProducts.find((p) => p.id === it.productId);
    const product: Product =
      live || {
        id: it.productId,
        supermarketId: order.supermarketId,
        gondolaId: '',
        name: it.name,
        price: it.price,
        imageUrl: it.imageUrl,
        active: true,
      };
    const stock = availableStock(product);
    if (typeof stock === 'number' && stock <= 0) {
      unavailable.push(it.name);
      return;
    }
    let qty = it.quantity;
    if (typeof stock === 'number' && qty > stock) {
      qty = stock;
      capped = true;
    }
    lines.push({ product, quantity: qty });
  });

  return { lines, unavailable, capped };
}
