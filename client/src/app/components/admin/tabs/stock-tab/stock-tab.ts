import { Component, computed, inject } from '@angular/core';
import { LucideAngularModule, Boxes, TriangleAlert, CircleX } from 'lucide-angular';
import { ProductService } from '../../../../services/product.service';
import { ToastService } from '../../../../services/toast.service';
import { ApiError } from '../../../../services/api-error';
import { StatCard } from '../../stat-card/stat-card';
import { StockInput } from '../../stock-input/stock-input';
import { AuthService } from '../../../../services/auth.service';

const LOW_STOCK_THRESHOLD = 5;

function totalStockOf(stock: Record<string, number>): number {
  return Object.values(stock).reduce((sum, qty) => sum + qty, 0);
}

function stockOf(stock: Record<string, number>, size: string): number {
  return stock[size] ?? 0;
}

@Component({
  selector: 'app-stock-tab',
  imports: [LucideAngularModule, StatCard, StockInput],
  templateUrl: './stock-tab.html',
})
export class StockTab {
  private auth = inject(AuthService);
  /** Só "ver" na tela: os controles que gravam somem ou ficam desativados. */
  readonly canEdit = computed(() => this.auth.can('estoque', 'edit') || this.auth.can('produtos', 'edit'));
  productService = inject(ProductService);
  private toastService = inject(ToastService);

  readonly Boxes = Boxes;
  readonly TriangleAlert = TriangleAlert;
  readonly CircleX = CircleX;
  readonly LOW_STOCK_THRESHOLD = LOW_STOCK_THRESHOLD;
  readonly totalStockOf = totalStockOf;
  readonly stockOf = stockOf;

  readonly stats = computed(() => {
    const totals = this.productService.products().map((p) => totalStockOf(p.stock));
    return {
      totalUnidades: totals.reduce((sum, t) => sum + t, 0),
      estoqueBaixo: totals.filter((t) => t > 0 && t <= LOW_STOCK_THRESHOLD).length,
      esgotados: totals.filter((t) => t === 0).length,
    };
  });

  makeCommitHandler(productId: string, size: string): (quantity: number) => Promise<void> {
    return async (quantity: number) => {
      try {
        await this.productService.updateStock(productId, size, quantity);
      } catch (err) {
        this.toastService.showToast(
          'Erro ao atualizar estoque',
          err instanceof ApiError ? err.message : undefined
        );
      }
    };
  }
}
