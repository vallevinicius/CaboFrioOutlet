import { Component, computed, input, model, signal } from '@angular/core';
import { LucideAngularModule, SlidersHorizontal, X } from 'lucide-angular';
import { SORT_OPTIONS, SortKey } from '../../utils/product-list';

@Component({
  selector: 'app-product-toolbar',
  imports: [LucideAngularModule],
  templateUrl: './product-toolbar.html',
})
export class ProductToolbar {
  readonly SlidersHorizontal = SlidersHorizontal;
  readonly X = X;
  readonly sortOptions = SORT_OPTIONS;

  /** Tamanhos disponíveis no catálogo (com estoque). */
  sizeOptions = input.required<string[]>();
  brandOptions = input.required<string[]>();
  resultCount = input.required<number>();

  sort = model.required<SortKey>();
  brand = model.required<string>();
  sizes = model.required<string[]>();
  priceMin = model.required<number | null>();
  priceMax = model.required<number | null>();

  panelOpen = signal(false);

  readonly activeCount = computed(
    () => (this.brand() !== 'todos' ? 1 : 0) + this.sizes().length + (this.priceMin() !== null || this.priceMax() !== null ? 1 : 0),
  );

  toggleSize(size: string): void {
    this.sizes.update((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));
  }

  setBrand(brand: string): void {
    this.brand.set(this.brand() === brand ? 'todos' : brand);
  }

  onPrice(field: 'min' | 'max', raw: string): void {
    const value = parseFloat(raw.replace(',', '.'));
    const parsed = Number.isFinite(value) && value >= 0 ? value : null;
    (field === 'min' ? this.priceMin : this.priceMax).set(parsed);
  }

  clear(): void {
    this.brand.set('todos');
    this.sizes.set([]);
    this.priceMin.set(null);
    this.priceMax.set(null);
  }
}
