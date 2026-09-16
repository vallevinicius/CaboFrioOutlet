import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { LucideAngularModule, Plus, ChevronRight } from 'lucide-angular';
import { Navbar } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';
import { CartDrawer } from '../../components/cart-drawer/cart-drawer';
import { ImageLightbox } from '../../components/image-lightbox/image-lightbox';
import { ProductService } from '../../services/product.service';
import { CartService, getDiscountedPrice } from '../../services/cart.service';
import { ToastService } from '../../services/toast.service';
import { SettingsService } from '../../services/settings.service';
import { ProductCategory } from '../../types/product';

type CategoryOrAll = ProductCategory | 'todos';

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Component({
  selector: 'app-product-page',
  imports: [LucideAngularModule, RouterLink, Navbar, Footer, CartDrawer, ImageLightbox],
  templateUrl: './product-page.html',
})
export class ProductPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private toastService = inject(ToastService);
  private titleService = inject(Title);
  private settingsService = inject(SettingsService);

  readonly Plus = Plus;
  readonly ChevronRight = ChevronRight;
  readonly formatPrice = formatPrice;
  readonly getDiscountedPrice = getDiscountedPrice;

  // navbar precisa desses inputs, mas essa página não filtra produtos
  activeCategory = signal<CategoryOrAll>('todos');
  searchQuery = signal('');

  lightboxOpen = signal(false);
  selectedSizeOverride = signal<string | null>(null);

  private paramMap = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private productId = computed(() => this.paramMap().get('id') ?? '');

  readonly product = computed(() => this.productService.products().find((p) => p.id === this.productId()));
  readonly notFound = computed(() => !this.productService.loading() && !this.product());

  private firstAvailableSize = computed(() => {
    const product = this.product();
    if (!product) return undefined;
    return product.sizes.find((size) => (product.stock[size] ?? 0) > 0) ?? product.sizes[0];
  });

  readonly selectedSize = computed(() => this.selectedSizeOverride() ?? this.firstAvailableSize());

  readonly totalStock = computed(() => {
    const product = this.product();
    if (!product) return 0;
    return Object.values(product.stock).reduce((sum, qty) => sum + qty, 0);
  });
  readonly isOutOfStock = computed(() => this.totalStock() === 0);
  readonly finalPrice = computed(() => {
    const product = this.product();
    return product ? getDiscountedPrice(product) : 0;
  });
  readonly hasDiscount = computed(() => Boolean(this.product()?.discountPercent));
  readonly selectedSizeAvailable = computed(() => {
    const product = this.product();
    const size = this.selectedSize();
    if (!product || !size) return false;
    return (product.stock[size] ?? 0) > 0;
  });
  readonly canAddToCart = computed(() => !this.isOutOfStock() && this.selectedSizeAvailable());

  constructor() {
    effect(() => {
      const product = this.product();
      if (product) {
        this.titleService.setTitle(`${product.name} — ${this.settingsService.settings().storeName}`);
      }
    });
  }

  isSizeAvailable(size: string): boolean {
    const product = this.product();
    return Boolean(product && (product.stock[size] ?? 0) > 0);
  }

  selectSize(size: string): void {
    if (this.isSizeAvailable(size)) {
      this.selectedSizeOverride.set(size);
    }
  }

  handleAddToCart(): void {
    const product = this.product();
    const size = this.selectedSize();
    if (!product || !size || !this.canAddToCart()) return;
    this.cartService.addToCart(product, size);
    this.toastService.showToast('Produto adicionado!', `${product.name} (Tam. ${size})`);
  }

  handleCategoryChange(): void {
    this.router.navigateByUrl('/');
  }
}
