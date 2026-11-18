import { ALL_PRODUCTS_PATH, CategoryPage } from './categories';

export interface FooterLink {
  label: string;
  /** Rota interna. */
  path: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

/** Colunas do rodapé; a de categorias vem do painel (só as ativas). */
export function footerColumns(categories: CategoryPage[]): FooterColumn[] {
  return [
  {
    title: 'Institucional',
    links: [
      { label: 'Sobre nós', path: '/sobre-nos' },
      { label: 'Atacado', path: '/atacado' },
      { label: 'Contato', path: '/contato' },
      { label: 'Trabalhe conosco', path: '/trabalhe-conosco' },
    ],
  },
  {
    title: 'Ajuda',
    links: [
      { label: 'Trocas e devoluções', path: '/trocas-e-devolucoes' },
      { label: 'Perguntas frequentes', path: '/perguntas-frequentes' },
      { label: 'Guia de medidas', path: '/guia-de-medidas' },
    ],
  },
  {
    title: 'Categorias',
    links: [
      ...categories.map((c) => ({ label: c.label, path: c.path })),
      { label: 'Todos os produtos', path: ALL_PRODUCTS_PATH },
    ],
  },
  ];
}
