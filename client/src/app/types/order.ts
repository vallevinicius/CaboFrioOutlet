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

export interface Order {
  id: string;
  createdAt: string;
  customerName: string;
  customerContact: string;
  items: OrderItem[];
  total: number;
  shippingCost: number;
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
  paymentMethod?: string | null;
  installments?: number | null;
}
