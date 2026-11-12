import { ProductCategory } from './product';

export interface WholesaleQuoteInput {
  name: string;
  company: string;
  cnpj: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  interests: ProductCategory[];
  estimatedPieces: number | null;
  message: string;
  /** Peças escolhidas no site; o servidor recalcula preços e desconto. */
  items?: { productId: string; size: string; quantity: number }[];
  consent: boolean;
  /** Campo-isca anti-robô: sempre vazio para pessoas. */
  website: string;
}

export interface WholesaleQuote {
  id: string;
  createdAt: string;
  name: string;
  company: string;
  cnpj: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  interests: ProductCategory[];
  estimatedPieces: number | null;
  message: string;
  items: { productId: string; name: string; size: string; quantity: number; unitPrice: number }[];
  estimatedTotal: number | null;
  discountPercent: number | null;
  handled: boolean;
}
