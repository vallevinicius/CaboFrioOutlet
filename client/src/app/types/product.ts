import type { SalesChannel } from '../utils/channel';

export type ProductCategory = 'bermudas' | 'calças' | 'camisas' | 'bonés';

export interface ProductInput {
  name: string;
  price: number;
  category: ProductCategory;
  brand?: string;
  image: string;
  /** Fotos adicionais (a capa é `image`). */
  images?: string[];
  description: string;
  sizes: string[];
  discountPercent?: number;
  isNew?: boolean;
  /** Onde a peça é vendida. Ausente (API antiga) = ambos. */
  channel?: SalesChannel;
  /** Quantidade disponível por tamanho. */
  stock: Record<string, number>;
}

export interface Product extends ProductInput {
  id: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize: string;
}
