import { Injectable, computed, inject, signal } from '@angular/core';
import { CartItem, Product } from '../types/product';
import { SettingsService } from './settings.service';
import { discountedUnitPrice, nextTier, tierFor } from '../utils/wholesale-pricing';

export function getDiscountedPrice(product: Product): number {
  if (product.discountPercent) {
    return product.price * (1 - product.discountPercent / 100);
  }
  return product.price;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private settingsService = inject(SettingsService);
  private _items = signal<CartItem[]>([]);
  private _wholesale = signal(false);
  private _isCartOpen = signal(false);

  readonly items = this._items.asReadonly();
  readonly isCartOpen = this._isCartOpen.asReadonly();

  readonly totalItems = computed(() => this._items().reduce((sum, item) => sum + item.quantity, 0));

  /** Carrinho de atacado: o desconto por quantidade só existe neste modo (vem da página de Atacado). */
  readonly wholesale = this._wholesale.asReadonly();

  /** Percentual de atacado atingido pela quantidade total de peças (0 fora do modo atacado). */
  readonly wholesalePercent = computed(() =>
    this._wholesale() ? (tierFor(this.settingsService.settings().wholesaleTiers, this.totalItems())?.discountPercent ?? 0) : 0
  );
  readonly meetsWholesaleMin = computed(() => this.totalItems() >= this.settingsService.settings().wholesaleMinPieces);
  readonly nextWholesaleTier = computed(() =>
    this._wholesale() ? nextTier(this.settingsService.settings().wholesaleTiers, this.totalItems()) : null
  );

  /** Preço unitário de uma linha, já com o desconto de atacado quando aplicável. */
  unitPrice(item: CartItem): number {
    const base = getDiscountedPrice(item.product);
    const percent = this.wholesalePercent();
    return percent > 0 ? discountedUnitPrice(base, percent) : base;
  }

  readonly totalPrice = computed(() =>
    this._items().reduce((sum, item) => sum + this.unitPrice(item) * item.quantity, 0)
  );

  /** Troca o conteúdo do carrinho pelo pedido montado na página de Atacado e liga o modo atacado. */
  startWholesale(lines: { product: Product; selectedSize: string; quantity: number }[]): void {
    this._items.set(lines.filter((l) => l.quantity > 0).map((l) => ({ product: l.product, selectedSize: l.selectedSize, quantity: l.quantity })));
    this._wholesale.set(true);
  }

  /** Volta para a compra normal (sem desconto por quantidade), mantendo as peças. */
  leaveWholesale(): void {
    this._wholesale.set(false);
  }

  addToCart(product: Product, selectedSize: string): void {
    this._items.update((prev) => {
      const existing = prev.find(
        (item) => item.product.id === product.id && item.selectedSize === selectedSize
      );
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id && item.selectedSize === selectedSize
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, selectedSize }];
    });
  }

  removeFromCart(productId: string, selectedSize: string): void {
    this._items.update((prev) =>
      prev.filter((item) => !(item.product.id === productId && item.selectedSize === selectedSize))
    );
  }

  updateQuantity(productId: string, selectedSize: string, quantity: number): void {
    if (quantity <= 0) {
      this._items.update((prev) =>
        prev.filter((item) => !(item.product.id === productId && item.selectedSize === selectedSize))
      );
      return;
    }
    this._items.update((prev) =>
      prev.map((item) =>
        item.product.id === productId && item.selectedSize === selectedSize
          ? { ...item, quantity }
          : item
      )
    );
  }

  clearCart(): void {
    this._items.set([]);
    this._wholesale.set(false);
  }

  openCart(): void {
    this._isCartOpen.set(true);
  }

  closeCart(): void {
    this._isCartOpen.set(false);
  }
}
