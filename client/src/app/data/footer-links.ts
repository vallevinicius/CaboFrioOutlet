import { CATEGORY_PAGES, ALL_PRODUCTS_PATH } from './categories';

export interface FooterLink {
  label: string;
  /** Rota interna. */
  path: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
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
      ...CATEGORY_PAGES.map((c) => ({ label: c.label, path: c.path })),
      { label: 'Todos os produtos', path: ALL_PRODUCTS_PATH },
    ],
  },
];
