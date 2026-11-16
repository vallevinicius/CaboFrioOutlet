import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { LucideAngularModule, ChevronDown, ChevronUp, Receipt, Clock, CircleCheckBig } from 'lucide-angular';
import { Order, OrderStatus } from '../../../../types/order';
import { ApiService } from '../../../../services/api.service';
import { ToastService } from '../../../../services/toast.service';
import { ApiError } from '../../../../services/api-error';
import { StatCard } from '../../stat-card/stat-card';
import { OrderDetails } from '../../order-details/order-details';
import { STATUS_LABELS, STATUS_STYLES, formatOrderPrice, formatOrderDate } from '../../../../utils/order-format';
import { AuthService } from '../../../../services/auth.service';
import { describePaymentFailure } from '../../../../utils/payment-failure';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = (
  Object.entries(STATUS_LABELS) as [OrderStatus, string][]
).map(([value, label]) => ({ value, label }));

@Component({
  selector: 'app-orders-tab',
  imports: [LucideAngularModule, StatCard, OrderDetails],
  templateUrl: './orders-tab.html',
})
export class OrdersTab implements OnInit {
  readonly describePaymentFailure = describePaymentFailure;
  private auth = inject(AuthService);
  /** Só "ver" na tela: os controles que gravam somem ou ficam desativados. */
  readonly canEdit = computed(() => this.auth.can('pedidos', 'edit'));
  private api = inject(ApiService);
  private toastService = inject(ToastService);

  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Receipt = Receipt;
  readonly Clock = Clock;
  readonly CircleCheckBig = CircleCheckBig;
  readonly statusOptions = STATUS_OPTIONS;
  readonly statusStyles = STATUS_STYLES;
  readonly formatPrice = formatOrderPrice;
  readonly formatDate = formatOrderDate;

  orders = signal<Order[]>([]);
  loading = signal(true);
  expandedId = signal<string | null>(null);

  readonly stats = computed(() => {
    const orders = this.orders();
    return {
      total: orders.length,
      pendentes: orders.filter((o) => o.status === 'pendente').length,
      faturamento: Math.round(
        orders.filter((o) => o.status !== 'cancelado').reduce((sum, o) => sum + o.total, 0)
      ),
    };
  });

  ngOnInit(): void {
    this.api
      .get<Order[]>('/orders')
      .then((data) => this.orders.set(data))
      .catch((err) =>
        this.toastService.showToast('Erro ao carregar pedidos', err instanceof ApiError ? err.message : undefined)
      )
      .finally(() => this.loading.set(false));
  }

  toggleExpanded(orderId: string): void {
    this.expandedId.update((current) => (current === orderId ? null : orderId));
  }

  async handleStatusChange(order: Order, status: OrderStatus): Promise<void> {
    const previous = this.orders();
    this.orders.update((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    try {
      await this.api.patch(`/orders/${order.id}/status`, { status });
    } catch (err) {
      this.orders.set(previous);
      this.toastService.showToast('Erro ao atualizar status', err instanceof ApiError ? err.message : undefined);
    }
  }
}
