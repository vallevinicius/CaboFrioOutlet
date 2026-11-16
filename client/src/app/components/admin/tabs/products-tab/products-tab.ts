import { Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule, Plus, Package, Tag, Sparkles } from 'lucide-angular';
import { ProductService } from '../../../../services/product.service';
import { ToastService } from '../../../../services/toast.service';
import { Product, ProductInput } from '../../../../types/product';
import { ApiError } from '../../../../services/api-error';
import { ProductForm } from '../../product-form/product-form';
import { ProductTable } from '../../product-table/product-table';
import { StatCard } from '../../stat-card/stat-card';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-products-tab',
  imports: [LucideAngularModule, ProductForm, ProductTable, StatCard],
  templateUrl: './products-tab.html',
})
export class ProductsTab {
  private auth = inject(AuthService);
  /** Só "ver" na tela: os controles que gravam somem ou ficam desativados. */
  readonly canEdit = computed(() => this.auth.can('produtos', 'edit'));
  productService = inject(ProductService);
  private toastService = inject(ToastService);

  readonly Plus = Plus;
  readonly Package = Package;
  readonly Tag = Tag;
  readonly Sparkles = Sparkles;

  formOpen = signal(false);
  editingProduct = signal<Product | null>(null);

  readonly stats = computed(() => {
    const products = this.productService.products();
    return {
      total: products.length,
      novidades: products.filter((p) => p.isNew).length,
      promocoes: products.filter((p) => Boolean(p.discountPercent)).length,
    };
  });

  openCreateForm(): void {
    this.editingProduct.set(null);
    this.formOpen.set(true);
  }

  openEditForm(product: Product): void {
    this.editingProduct.set(product);
    this.formOpen.set(true);
  }

  async handleSubmit(input: ProductInput): Promise<void> {
    try {
      const editing = this.editingProduct();
      if (editing) {
        await this.productService.updateProduct(editing.id, input);
        this.toastService.showToast('Produto atualizado!', input.name);
      } else {
        await this.productService.addProduct(input);
        this.toastService.showToast('Produto adicionado!', input.name);
      }
      this.formOpen.set(false);
    } catch (err) {
      this.toastService.showToast('Erro ao salvar produto', err instanceof ApiError ? err.message : undefined);
    }
  }

  handleDelete(product: Product): void {
    this.toastService.showConfirm(`Excluir "${product.name}" do catálogo?`, 'Essa ação não pode ser desfeita.', async () => {
      try {
        await this.productService.deleteProduct(product.id);
        this.toastService.showToast('Produto excluído', product.name);
      } catch (err) {
        this.toastService.showToast('Erro ao excluir produto', err instanceof ApiError ? err.message : undefined);
      }
    });
  }
}
