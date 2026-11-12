import { Component, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductService } from '../../services/product.service';
import { SettingsService } from '../../services/settings.service';
import { ProductCategory } from '../../types/product';
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  SortKey,
  availableSizes,
  filterProducts,
  sortProducts,
} from '../../utils/product-list';
import { Navbar } from '../../components/navbar/navbar';
import { AnnouncementBar } from '../../components/announcement-bar/announcement-bar';
import { Hero } from '../../components/hero/hero';
import { BrandShowcase } from '../../components/brand-showcase/brand-showcase';
import { CategoryFilter } from '../../components/category-filter/category-filter';
import { ProductToolbar } from '../../components/product-toolbar/product-toolbar';
import { ProductGrid } from '../../components/product-grid/product-grid';
import { Ticker } from '../../components/ticker/ticker';
import { CategoryTiles } from '../../components/category-tiles/category-tiles';
import { NewArrivals } from '../../components/new-arrivals/new-arrivals';
import { WholesaleBanner } from '../../components/wholesale-banner/wholesale-banner';
import { BrandStory } from '../../components/brand-story/brand-story';
import { CartDrawer } from '../../components/cart-drawer/cart-drawer';
import { Footer } from '../../components/footer/footer';
import { GoogleReviews } from '../../components/google-reviews/google-reviews';
import { StoreLocation } from '../../components/store-location/store-location';

type CategoryOrAll = ProductCategory | 'todos';

const VALID_CATEGORIES: readonly ProductCategory[] = ['camisas', 'calças', 'bermudas', 'bonés'];

@Component({
  selector: 'app-storefront-page',
  imports: [
    Navbar,
    AnnouncementBar,
    Hero,
    BrandShowcase,
    CategoryFilter,
    ProductGrid,
    ProductToolbar,
    Ticker,
    CategoryTiles,
    NewArrivals,
    BrandStory,
    WholesaleBanner,
    CartDrawer,
    Footer,
    StoreLocation,
    GoogleReviews,
  ],
  templateUrl: './storefront-page.html',
})
export class StorefrontPage {
  private productService = inject(ProductService);
  private settingsService = inject(SettingsService);
  private titleService = inject(Title);
  private route = inject(ActivatedRoute);
  private queryParams = toSignal(this.route.queryParamMap);

  readonly products = this.productService.products;
  readonly loading = this.productService.loading;

  activeCategory = signal<CategoryOrAll>('todos');
  activeBrand = signal<string>('todos');
  searchQuery = signal('');
  sort = signal<SortKey>('relevancia');
  sizes = signal<string[]>([]);
  priceMin = signal<number | null>(null);
  priceMax = signal<number | null>(null);
  visibleCount = signal(PAGE_SIZE);

  constructor() {
    // Links de categoria do rodapé: /?categoria=camisas
    effect(() => {
      const param = this.queryParams()?.get('categoria');
      if (param && (VALID_CATEGORIES as readonly string[]).includes(param)) {
        this.activeCategory.set(param as ProductCategory);
      }
    });

    effect(() => {
      // Qualquer mudança de filtro volta para a primeira página.
      this.activeCategory();
      this.activeBrand();
      this.sizes();
      this.priceMin();
      this.priceMax();
      this.searchQuery();
      this.sort();
      this.visibleCount.set(PAGE_SIZE);
    });

    effect(() => {
      this.titleService.setTitle(this.settingsService.settings().storeName);
    });
  }

  /** Peças marcadas como novas e com estoque, para a faixa "Chegou agora". */
  readonly newArrivals = computed(() =>
    this.products()
      .filter((p) => p.isNew && Object.values(p.stock).some((q) => q > 0))
      .slice(0, 10),
  );

  selectCategory(category: ProductCategory): void {
    this.activeCategory.set(category);
    this.scrollToProducts();
  }

  selectBrand(brand: string): void {
    this.activeBrand.set(brand);
    this.scrollToProducts();
  }

  private scrollToProducts(): void {
    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
  }

  readonly brands = computed(() => this.settingsService.settings().brands);
  readonly sizeOptions = computed(() => availableSizes(this.products()));

  readonly filteredProducts = computed(() =>
    sortProducts(
      filterProducts(this.products(), {
        ...DEFAULT_FILTERS,
        category: this.activeCategory(),
        brand: this.activeBrand(),
        sizes: this.sizes(),
        priceMin: this.priceMin(),
        priceMax: this.priceMax(),
        query: this.searchQuery(),
        sort: this.sort(),
      }),
      this.sort(),
    ),
  );

  readonly visibleProducts = computed(() => this.filteredProducts().slice(0, this.visibleCount()));
  readonly hasMore = computed(() => this.filteredProducts().length > this.visibleCount());

  loadMore(): void {
    this.visibleCount.update((n) => n + PAGE_SIZE);
  }

  readonly categoryCounts = computed(() => {
    const products = this.products();
    const counts: Record<CategoryOrAll, number> = {
      todos: products.length,
      camisas: 0,
      calças: 0,
      bermudas: 0,
      bonés: 0,
    };
    products.forEach((p) => {
      counts[p.category] += 1;
    });
    return counts;
  });
}
