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
}

/** Visão do painel: inclui ocultas e quantas peças cada uma tem. */
export interface AdminCategory extends Category {
  productCount: number;
}

export interface CategoryInput {
  name: string;
  intro: string;
  description: string;
  image: string;
}
