import { Component, computed, inject, signal } from '@angular/core';
import { AppImageDirective } from '../../../../directives/app-image.directive';
import { LucideAngularModule, Boxes, TriangleAlert, CircleX, Plus, X } from 'lucide-angular';
import { ProductService } from '../../../../services/product.service';
import { ToastService } from '../../../../services/toast.service';
import { ApiError } from '../../../../services/api-error';
import { StatCard } from '../../stat-card/stat-card';
import { StockInput } from '../../stock-input/stock-input';
import { AuthService } from '../../../../services/auth.service';
import { Product } from '../../../../types/product';
import { MAX_SIZE_LENGTH, checkNewSize } from '../../../../utils/sizes';

const LOW_STOCK_THRESHOLD = 5;

function totalStockOf(stock: Record<string, number>): number {
  return Object.values(stock).reduce((sum, qty) => sum + qty, 0);
}

function stockOf(stock: Record<string, number>, size: string): number {
  return stock[size] ?? 0;
}

@Component({
  selector: 'app-stock-tab',
  imports: [AppImageDirective, LucideAngularModule, StatCard, StockInput],
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
  readonly Plus = Plus;
  readonly X = X;
  readonly MAX_SIZE_LENGTH = MAX_SIZE_LENGTH;
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

  /** Texto digitado no campo "+ tamanho" de cada produto. */
  readonly newSizeDraft = signal<Record<string, string | undefined>>({});

  setNewSizeDraft(productId: string, value: string): void {
    this.newSizeDraft.update((d) => ({ ...d, [productId]: value }));
  }

  async addSize(product: Product, event?: Event): Promise<void> {
    event?.preventDefault();
    const check = checkNewSize(product.sizes, this.newSizeDraft()[product.id] ?? '');
    if (!check.ok) {
      this.toastService.showToast('Tamanho inválido', check.error);
      return;
    }
    try {
      await this.productService.addSize(product.id, check.size);
      this.setNewSizeDraft(product.id, '');
      this.toastService.showToast('Tamanho adicionado', `${check.size} entrou com estoque 0. Ajuste a quantidade.`);
    } catch (err) {
      this.toastService.showToast('Erro ao adicionar tamanho', err instanceof ApiError ? err.message : undefined);
    }
  }

  removeSize(product: Product, size: string): void {
    this.toastService.showConfirm(
      `Remover o tamanho ${size} de ${product.name}?`,
      'O estoque desse tamanho some da loja. Pedidos já feitos não mudam.',
      async () => {
        try {
          await this.productService.removeSize(product.id, size);
          this.toastService.showToast('Tamanho removido');
        } catch (err) {
          this.toastService.showToast('Erro ao remover tamanho', err instanceof ApiError ? err.message : undefined);
        }
      },
      { confirmLabel: 'Remover' }
    );
  }
}
