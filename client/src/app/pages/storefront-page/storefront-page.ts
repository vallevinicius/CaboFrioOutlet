import { Component, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductService } from '../../services/product.service';
import { SettingsService } from '../../services/settings.service';
import { ProductCategory } from '../../types/product';
import { Navbar } from '../../components/navbar/navbar';
import { AnnouncementBar } from '../../components/announcement-bar/announcement-bar';
import { Hero } from '../../components/hero/hero';
import { BrandShowcase } from '../../components/brand-showcase/brand-showcase';
import { CategoryFilter } from '../../components/category-filter/category-filter';
import { ProductGrid } from '../../components/product-grid/product-grid';
import { BrandBanner } from '../../components/brand-banner/brand-banner';
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
    BrandBanner,
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

  constructor() {
    // Links de categoria do rodapé: /?categoria=camisas
    effect(() => {
      const param = this.queryParams()?.get('categoria');
      if (param && (VALID_CATEGORIES as readonly string[]).includes(param)) {
        this.activeCategory.set(param as ProductCategory);
      }
    });

    effect(() => {
      this.titleService.setTitle(this.settingsService.settings().storeName);
    });
  }

  readonly filteredProducts = computed(() => {
    const products = this.products();
    const category = this.activeCategory();
    const brand = this.activeBrand();
    let list = category === 'todos' ? products : products.filter((p) => p.category === category);
    if (brand !== 'todos') {
      list = list.filter((p) => p.brand === brand);
    }
    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      list = list.filter((p) => p.name.toLowerCase().includes(query));
    }
    return list;
  });

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
