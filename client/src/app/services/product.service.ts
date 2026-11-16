import { Injectable, computed, inject, signal } from '@angular/core';
import { Product, ProductInput } from '../types/product';
import { ApiService } from './api.service';
import { filterByChannel } from '../utils/channel';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private api = inject(ApiService);

  private _products = signal<Product[]>([]);
  private _loading = signal(true);

  /** Catálogo completo (painel admin). A loja e o atacado usam as listas por canal abaixo. */
  readonly products = this._products.asReadonly();
  /** O que a loja (varejo) pode mostrar e vender. */
  readonly retailProducts = computed(() => filterByChannel(this._products(), 'retail'));
  /** O que a página de atacado pode mostrar e vender. */
  readonly wholesaleProducts = computed(() => filterByChannel(this._products(), 'wholesale'));
  readonly loading = this._loading.asReadonly();

  constructor() {
    this.refresh().finally(() => this._loading.set(false));
  }

  async refresh(): Promise<void> {
    const data = await this.api.get<Product[]>('/products');
    this._products.set(data);
  }

  async addProduct(input: ProductInput): Promise<void> {
    await this.api.post('/products', input);
    await this.refresh();
  }

  async updateProduct(id: string, input: ProductInput): Promise<void> {
    await this.api.put(`/products/${id}`, input);
    await this.refresh();
  }

  async deleteProduct(id: string): Promise<void> {
    await this.api.delete(`/products/${id}`);
    await this.refresh();
  }

  async updateStock(productId: string, size: string, quantity: number): Promise<void> {
    await this.api.put(`/products/${productId}/stock`, { size, quantity });
    await this.refresh();
  }

  /** Cria o tamanho com estoque zero (a rota de estoque cria o tamanho se ele não existir). */
  async addSize(productId: string, size: string): Promise<void> {
    await this.updateStock(productId, size, 0);
  }

  async removeSize(productId: string, size: string): Promise<void> {
    await this.api.delete(`/products/${productId}/stock/${encodeURIComponent(size)}`);
    await this.refresh();
  }
}
