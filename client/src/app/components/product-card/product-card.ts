import { Component, computed, inject, input, signal } from '@angular/core';
import { AppImageDirective } from '../../directives/app-image.directive';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Plus, Check } from 'lucide-angular';
import { Product } from '../../types/product';
import { CartService, getDiscountedPrice } from '../../services/cart.service';
import { ToastService } from '../../services/toast.service';
import { AnalyticsService } from '../../services/analytics.service';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { ImageLightbox } from '../image-lightbox/image-lightbox';

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Component({
  selector: 'app-product-card',
  imports: [AppImageDirective, LucideAngularModule, RouterLink, ImageLightbox, FavoriteButton],
  templateUrl: './product-card.html',
})
export class ProductCard {
  private cartService = inject(CartService);
  private toastService = inject(ToastService);
  private analytics = inject(AnalyticsService);

  readonly Plus = Plus;
  readonly Check = Check;
  readonly formatPrice = formatPrice;

  product = input.required<Product>();

  lightboxOpen = signal(false);

  private firstAvailableSize = computed(() => {
    const product = this.product();
    return product.sizes.find((size) => (product.stock[size] ?? 0) > 0) ?? product.sizes[0];
  });

  private selectedSizeOverride = signal<string | null>(null);

  readonly selectedSize = computed(() => this.selectedSizeOverride() ?? this.firstAvailableSize());

  readonly totalStock = computed(() =>
    Object.values(this.product().stock).reduce((sum, qty) => sum + qty, 0)
  );
  readonly isOutOfStock = computed(() => this.totalStock() === 0);
  readonly finalPrice = computed(() => getDiscountedPrice(this.product()));
  readonly hasDiscount = computed(() => Boolean(this.product().discountPercent));
  readonly selectedSizeAvailable = computed(
    () => (this.product().stock[this.selectedSize()] ?? 0) > 0
  );
  readonly canAddToCart = computed(() => !this.isOutOfStock() && this.selectedSizeAvailable());

  isSizeAvailable(size: string): boolean {
    return (this.product().stock[size] ?? 0) > 0;
  }

  selectSize(size: string): void {
    if (this.isSizeAvailable(size)) {
      this.selectedSizeOverride.set(size);
    }
  }

  handleAddToCart(): void {
    if (!this.canAddToCart()) return;
    const product = this.product();
    const size = this.selectedSize();
    this.cartService.addToCart(product, size);
    this.analytics.addToCart(product, size);
    this.toastService.showAddedToCart(product.name, size, () => this.cartService.openCart());
    this.flashAdded();
  }

  /** Mostra "Adicionado!" no botão por um instante, para o clique ter resposta imediata. */
  justAdded = signal(false);
  private justAddedTimer: ReturnType<typeof setTimeout> | undefined;

  private flashAdded(): void {
    clearTimeout(this.justAddedTimer);
    this.justAdded.set(true);
    this.justAddedTimer = setTimeout(() => this.justAdded.set(false), 2000);
  }

  openLightbox(event: Event): void {
    event.stopPropagation();
    this.lightboxOpen.set(true);
  }
}
