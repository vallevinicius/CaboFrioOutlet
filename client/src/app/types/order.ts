export type OrderStatus = 'pendente' | 'confirmado' | 'enviado' | 'entregue' | 'cancelado';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  image: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderAccount {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  createdAt: string;
  /** account = pedido feito logado; email = achado pelo mesmo e-mail (pedido de visitante). */
  linkedBy: 'account' | 'email';
}

export interface Order {
  id: string;
  createdAt: string;
  customerName: string;
  customerContact: string;
  items: OrderItem[];
  total: number;
  shippingCost: number;
  isWholesale?: boolean;
  wholesaleDiscountPercent?: number | null;
  shippingService?: string | null;
  shippingCep?: string | null;
  shippingStreet?: string | null;
  shippingNumber?: string | null;
  shippingComplement?: string | null;
  shippingNeighborhood?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  status: OrderStatus;
  userId?: string | null;
  /** Telefone/WhatsApp e CPF do cliente na hora da compra (só números). Pedidos antigos não têm. */
  customerPhone?: string | null;
  customerCpf?: string | null;
  /** Cadastro do cliente (só na lista do admin). */
  account?: OrderAccount | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  /** Motivo informado pelo Mercado Pago (ex.: cc_rejected_other_reason). */
  paymentStatusDetail?: string | null;
  installments?: number | null;
}
