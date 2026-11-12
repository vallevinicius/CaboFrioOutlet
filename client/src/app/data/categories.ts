import { ProductCategory } from '../types/product';

export interface CategoryPage {
  value: ProductCategory;
  /** Parte final da URL, sem acento. */
  slug: string;
  path: string;
  label: string;
  /** Frase curta que aparece no topo da página da categoria. */
  intro: string;
  /** Descrição para buscadores e compartilhamento. */
  description: string;
}

export const CATEGORY_PAGES: CategoryPage[] = [
  {
    value: 'camisas',
    slug: 'camisas',
    path: '/camisas',
    label: 'Camisas',
    intro: 'Camisetas básicas, oversized e estampadas para montar o look do dia.',
    description: 'Camisas e camisetas urbanas em Cabo Frio: básicas, oversized e estampadas, com preço de outlet.',
  },
  {
    value: 'calças',
    slug: 'calcas',
    path: '/calcas',
    label: 'Calças',
    intro: 'Calças para todo estilo: jeans, sarja e modelos urbanos.',
    description: 'Calças jeans, de sarja e modelos urbanos em Cabo Frio, com preço de outlet.',
  },
  {
    value: 'bermudas',
    slug: 'bermudas',
    path: '/bermudas',
    label: 'Bermudas',
    intro: 'Bermudas confortáveis e com atitude para o dia a dia.',
    description: 'Bermudas urbanas e confortáveis em Cabo Frio, com preço de outlet.',
  },
  {
    value: 'bonés',
    slug: 'bones',
    path: '/bones',
    label: 'Bonés',
    intro: 'Bonés de aba curva, aba reta e trucker para fechar o visual.',
    description: 'Bonés de aba curva, aba reta e trucker em Cabo Frio, com preço de outlet.',
  },
];

export const ALL_PRODUCTS_PATH = '/produtos';

export function categoryByValue(value: string): CategoryPage | undefined {
  return CATEGORY_PAGES.find((c) => c.value === value);
}

export function categoryBySlug(slug: string | undefined): CategoryPage | undefined {
  return CATEGORY_PAGES.find((c) => c.slug === slug);
}

/** Página da categoria que corresponde a um caminho de URL (ou undefined). */
export function categoryByPath(path: string): CategoryPage | undefined {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return CATEGORY_PAGES.find((c) => c.path === clean);
}

/** Caminho da página de uma categoria; categorias desconhecidas caem em "todos os produtos". */
export function pathForCategory(value: string): string {
  return categoryByValue(value)?.path ?? ALL_PRODUCTS_PATH;
}
