import { Product } from '../types/product';

export type SortKey = 'relevancia' | 'novidades' | 'menor-preco' | 'maior-preco';

export interface ListFilters {
  category: string; // 'todos' ou categoria
  brand: string; // 'todos' ou marca
  sizes: string[]; // vazio = qualquer
  priceMin: number | null;
  priceMax: number | null;
  query: string;
  sort: SortKey;
}

export const DEFAULT_FILTERS: ListFilters = {
  category: 'todos',
  brand: 'todos',
  sizes: [],
  priceMin: null,
  priceMax: null,
  query: '',
  sort: 'relevancia',
};

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevancia', label: 'Relevância' },
  { value: 'novidades', label: 'Novidades' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'maior-preco', label: 'Maior preço' },
];

export const PAGE_SIZE = 12;
export const LOW_STOCK_LIMIT = 3;

export function effectivePrice(p: Pick<Product, 'price' | 'discountPercent'>): number {
  return p.discountPercent ? p.price * (1 - p.discountPercent / 100) : p.price;
}

export function totalStock(p: Pick<Product, 'stock'>): number {
  return Object.values(p.stock).reduce((sum, q) => sum + q, 0);
}

/** Tamanhos com estoque, na ordem em que aparecem no catálogo (sem repetir). */
export function availableSizes(products: Product[]): string[] {
  const seen: string[] = [];
  for (const p of products) {
    for (const size of p.sizes) {
      if ((p.stock[size] ?? 0) > 0 && !seen.includes(size)) seen.push(size);
    }
  }
  return seen;
}

export function filterProducts(products: Product[], f: ListFilters): Product[] {
  const query = f.query.trim().toLowerCase();
  return products.filter((p) => {
    if (f.category !== 'todos' && p.category !== f.category) return false;
    if (f.brand !== 'todos' && p.brand !== f.brand) return false;
    // Tamanho conta só se houver estoque nele.
    if (f.sizes.length > 0 && !f.sizes.some((s) => (p.stock[s] ?? 0) > 0)) return false;
    const price = effectivePrice(p);
    if (f.priceMin !== null && price < f.priceMin) return false;
    if (f.priceMax !== null && price > f.priceMax) return false;
    if (query && !p.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

/** Ordena sem alterar a lista original. Relevância = ordem do servidor (mais recentes), esgotados por último. */
export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const list = [...products];
  const inStock = (p: Product) => (totalStock(p) > 0 ? 0 : 1);
  switch (sort) {
    case 'menor-preco':
      return list.sort((a, b) => inStock(a) - inStock(b) || effectivePrice(a) - effectivePrice(b));
    case 'maior-preco':
      return list.sort((a, b) => inStock(a) - inStock(b) || effectivePrice(b) - effectivePrice(a));
    case 'novidades':
      return list.sort((a, b) => inStock(a) - inStock(b) || Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)));
    default:
      return list.sort((a, b) => inStock(a) - inStock(b));
  }
}

export function activeFilterCount(f: ListFilters): number {
  return (
    (f.brand !== 'todos' ? 1 : 0) +
    f.sizes.length +
    (f.priceMin !== null || f.priceMax !== null ? 1 : 0)
  );
}

/** Peças da mesma categoria (priorizando a mesma marca), com estoque, sem a própria peça. */
export function relatedProducts(all: Product[], current: Product, limit = 4): Product[] {
  return all
    .filter((p) => p.id !== current.id && p.category === current.category && totalStock(p) > 0)
    .sort((a, b) => Number(b.brand === current.brand) - Number(a.brand === current.brand))
    .slice(0, limit);
}

export interface FreeShippingProgress {
  reached: boolean;
  remaining: number;
  percent: number;
}

export function freeShippingProgress(total: number, threshold: number): FreeShippingProgress {
  if (threshold <= 0) return { reached: true, remaining: 0, percent: 100 };
  const remaining = Math.max(0, threshold - total);
  return {
    reached: remaining === 0,
    remaining,
    percent: Math.min(100, Math.max(0, (total / threshold) * 100)),
  };
}

/** Texto de escassez: só aparece quando restam poucas unidades (e ainda há). */
export function lowStockLabel(qty: number): string | null {
  if (qty <= 0 || qty > LOW_STOCK_LIMIT) return null;
  return qty === 1 ? 'Última unidade!' : `Restam só ${qty} unidades`;
}
