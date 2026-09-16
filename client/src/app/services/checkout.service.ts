import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Order } from '../types/order';

export interface CreateOrderInput {
  customerName: string;
  customerContact: string;
  items: { productId: string; size: string; quantity: number }[];
}

export interface PayInput {
  orderId: string;
  token?: string;
  payment_method_id: string;
  issuer_id?: string;
  installments?: number;
  payer: {
    email: string;
    first_name?: string;
    last_name?: string;
    identification?: { type: string; number: string };
  };
}

export interface PayResult {
  status: string;
  statusDetail?: string;
  orderId: string;
  orderStatus: string;
  paymentId: number | string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
}

export interface OrderStatusResult {
  id: string;
  status: string;
  paymentStatus: string | null;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private api = inject(ApiService);

  getPublicKey(): Promise<{ publicKey: string }> {
    return this.api.get('/checkout/config');
  }

  createOrder(input: CreateOrderInput): Promise<Order> {
    return this.api.post('/orders', input);
  }

  pay(input: PayInput): Promise<PayResult> {
    return this.api.post('/checkout/pay', input);
  }

  getOrderStatus(orderId: string): Promise<OrderStatusResult> {
    return this.api.get(`/checkout/orders/${orderId}/status`);
  }
}
