/** Subcategoria como vem no site (só ativas): o slug vai no link ?tipo=. */
export interface SubcategoryRef {
  id: string;
  slug: string;
  name: string;
}

/** Categoria como vem da API (/api/categories). */
export interface Category {
  id: string;
  /** Valor gravado em Product.category. Nunca muda. */
  key: string;
  /** Endereço da página (/<slug>). Nunca muda. */
  slug: string;
  name: string;
  intro: string;
  description: string;
  image: string;
  order: number;
  /** false = oculta no site. */
  active: boolean;
  subcategories: SubcategoryRef[];
}

export interface AdminSubcategory extends SubcategoryRef {
  order: number;
  active: boolean;
  productCount: number;
}

/** Visão do painel: inclui ocultas e quantas peças cada uma tem. */
export interface AdminCategory extends Omit<Category, 'subcategories'> {
  productCount: number;
  subcategories: AdminSubcategory[];
}

export interface CategoryInput {
  name: string;
  intro: string;
  description: string;
  image: string;
}
