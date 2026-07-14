import type { Product, Gondola } from './types';

/** Normalize a string: lowercase, strip accents & non-alphanumerics. */
export function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '');
}

/**
 * Subsequence fuzzy match (tolerant to typos / extra chars), ported from the
 * loja storefront and made accent-insensitive (RF06).
 */
export function fuzzyMatch(query: string, target: string): boolean {
  const q = normalize(query);
  const t = normalize(target);
  if (!q) return true;
  if (t.includes(q)) return true;
  let qIdx = 0;
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) qIdx++;
  }
  return qIdx === q.length;
}

export interface ProductFilters {
  gondolaId?: string | null;
  brand?: string | null;
  onlyPromo?: boolean;
  tags?: string[]; // diet / vegano / etc.
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'name';
}

/** Filter + search the catalog (RF06, RF07). */
export function filterProducts(
  products: Product[],
  search: string,
  filters: ProductFilters,
  gondolas: Gondola[],
  isPromo: (p: Product) => boolean,
): Product[] {
  const gondolaName = (id?: string) => gondolas.find((g) => g.id === id)?.name || '';
  let list = products.filter((p) => {
    if (p.active === false) return false;
    if (filters.gondolaId && p.gondolaId !== filters.gondolaId) return false;
    if (filters.brand && (p.brand || '').toLowerCase() !== filters.brand.toLowerCase()) return false;
    if (filters.onlyPromo && !isPromo(p)) return false;
    if (filters.minPrice != null && p.price < filters.minPrice) return false;
    if (filters.maxPrice != null && p.price > filters.maxPrice) return false;
    if (filters.tags && filters.tags.length) {
      const pt = (p.tags || []).map((t) => normalize(t));
      if (!filters.tags.every((t) => pt.includes(normalize(t)))) return false;
    }
    if (search) {
      const haystack = [p.name, p.brand, p.subcategory, gondolaName(p.gondolaId), ...(p.tags || [])]
        .filter(Boolean)
        .join(' ');
      if (!fuzzyMatch(search, haystack)) return false;
    }
    return true;
  });

  switch (filters.sort) {
    case 'price_asc':
      list = list.slice().sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      list = list.slice().sort((a, b) => b.price - a.price);
      break;
    case 'name':
      list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return list;
}

/** Distinct brands present in the catalog (for the filter chips). */
export function collectBrands(products: Product[]): string[] {
  const set = new Set<string>();
  products.forEach((p) => p.brand && set.add(p.brand));
  return Array.from(set).sort();
}

/** Distinct dietary tags present in the catalog. */
export function collectTags(products: Product[]): string[] {
  const set = new Set<string>();
  products.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
  return Array.from(set).sort();
}
