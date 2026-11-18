import { Category, SubcategoryRef } from '../types/category';

export type { SubcategoryRef };

/** Categoria pronta para o site (menu, rodapé, home, listagem). Vem da API, aba Categorias do painel. */
export interface CategoryPage {
  id: string;
  /** Valor gravado no produto (Product.category). */
  value: string;
  /** Parte final da URL, sem acento. */
  slug: string;
  path: string;
  label: string;
  /** Frase curta que aparece no topo da página da categoria. */
  intro: string;
  /** Descrição para buscadores e compartilhamento. */
  description: string;
  /** Foto do quadro em "Escolha o seu estilo" (vazia = sem foto). */
  image: string;
  /** Subcategorias ativas, em ordem (filtro ?tipo= na página da categoria). */
  subcategories: SubcategoryRef[];
}

export const ALL_PRODUCTS_PATH = '/produtos';

export function toCategoryPage(c: Category): CategoryPage {
  return {
    id: c.id,
    value: c.key,
    slug: c.slug,
    path: `/${c.slug}`,
    label: c.name,
    intro: c.intro,
    description: c.description,
    image: c.image,
    subcategories: c.subcategories ?? [],
  };
}

export function findByValue(list: CategoryPage[], value: string): CategoryPage | undefined {
  return list.find((c) => c.value === value);
}

export function findBySlug(list: CategoryPage[], slug: string | undefined): CategoryPage | undefined {
  return slug ? list.find((c) => c.slug === slug) : undefined;
}

/** Página da categoria que corresponde a um caminho de URL (ou undefined). */
export function findByPath(list: CategoryPage[], path: string): CategoryPage | undefined {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return list.find((c) => c.path === clean);
}

/** Caminho da página de uma categoria; desconhecida ou oculta cai em "todos os produtos". */
export function pathForCategory(list: CategoryPage[], value: string): string {
  return findByValue(list, value)?.path ?? ALL_PRODUCTS_PATH;
}
