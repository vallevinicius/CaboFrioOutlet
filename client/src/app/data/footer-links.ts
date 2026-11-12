import { ProductCategory } from '../types/product';

export interface FooterLink {
  label: string;
  /** Rota interna. */
  path: string;
  /** Categoria da vitrine a filtrar ao abrir `path`. */
  category?: ProductCategory;
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
      { label: 'Camisas', path: '/', category: 'camisas' },
      { label: 'Calças', path: '/', category: 'calças' },
      { label: 'Bermudas', path: '/', category: 'bermudas' },
      { label: 'Bonés', path: '/', category: 'bonés' },
    ],
  },
];
