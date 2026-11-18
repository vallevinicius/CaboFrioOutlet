import { CategoryPage, SubcategoryRef } from '../data/categories';

/** Subcategorias da categoria que têm ao menos uma peça (as vazias não aparecem no site). */
export function visibleSubcategories(
  category: CategoryPage,
  products: { category: string; subcategoryId?: string | null }[],
): SubcategoryRef[] {
  const used = new Set(products.filter((p) => p.category === category.value && p.subcategoryId).map((p) => p.subcategoryId));
  return category.subcategories.filter((s) => used.has(s.id));
}
