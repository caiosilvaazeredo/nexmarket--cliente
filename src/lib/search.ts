/**
 * Lightweight fuzzy search (RF06) — no external dependency.
 *
 * Handles accents, case, and typos via a normalized Levenshtein distance so
 * "reineken" still matches "Heineken" and "tomate" matches "Tomate Italiano".
 * Good enough for client-side filtering of a single store's catalog; for very
 * large catalogs the same scoring can run server-side later.
 */
import type { Product } from './types';

export function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prevDiag = tmp;
    }
  }
  return prev[b.length];
}

/** 0 (no match) … 1 (perfect). Token-aware with fuzzy tolerance. */
export function matchScore(query: string, product: Product): number {
  const q = normalize(query);
  if (!q) return 1;
  const haystack = normalize(
    [product.name, product.brand, product.categoryName, ...(product.tags || [])]
      .filter(Boolean)
      .join(' '),
  );
  if (!haystack) return 0;

  if (haystack.includes(q)) return 1;

  const qTokens = q.split(' ');
  const hTokens = haystack.split(' ');
  let total = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const ht of hTokens) {
      if (ht.includes(qt) || qt.includes(ht)) {
        best = Math.max(best, 0.9);
        continue;
      }
      const dist = levenshtein(qt, ht);
      const tol = qt.length <= 4 ? 1 : 2; // allow more typos on longer words
      if (dist <= tol) best = Math.max(best, 1 - dist / Math.max(qt.length, ht.length));
    }
    total += best;
  }
  return total / qTokens.length;
}

export function searchProducts(query: string, products: Product[], threshold = 0.45): Product[] {
  if (!query.trim()) return products;
  return products
    .map((p) => ({ p, s: matchScore(query, p) }))
    .filter((x) => x.s >= threshold)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

/** Suggest the closest single product name when nothing matches well ("Você quis dizer…"). */
export function didYouMean(query: string, products: Product[]): string | null {
  const q = normalize(query);
  if (!q) return null;
  let best: { name: string; dist: number } | null = null;
  for (const p of products) {
    for (const token of normalize(p.name).split(' ')) {
      const dist = levenshtein(q.split(' ')[0], token);
      if (best === null || dist < best.dist) best = { name: p.name, dist };
    }
  }
  return best && best.dist <= 3 ? best.name : null;
}
