import { Component, computed, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductService } from '../../services/product.service';
import { SettingsService } from '../../services/settings.service';
import { CATEGORY_PAGES, categoryByValue } from '../../data/categories';
import { totalStock } from '../../utils/product-list';
import { Navbar } from '../../components/navbar/navbar';
import { AnnouncementBar } from '../../components/announcement-bar/announcement-bar';
import { Hero } from '../../components/hero/hero';
import { BrandShowcase } from '../../components/brand-showcase/brand-showcase';
import { Ticker } from '../../components/ticker/ticker';
import { CategoryTiles } from '../../components/category-tiles/category-tiles';
import { NewArrivals } from '../../components/new-arrivals/new-arrivals';
import { CategoryShowcase } from '../../components/category-showcase/category-showcase';
import { WholesaleBanner } from '../../components/wholesale-banner/wholesale-banner';
import { BrandStory } from '../../components/brand-story/brand-story';
import { CartDrawer } from '../../components/cart-drawer/cart-drawer';
import { Footer } from '../../components/footer/footer';
import { GoogleReviews } from '../../components/google-reviews/google-reviews';
import { StoreLocation } from '../../components/store-location/store-location';

/** Home: só destaques. A lista completa de cada categoria fica na própria página (/camisas, /calcas...). */
@Component({
  selector: 'app-storefront-page',
  imports: [
    Navbar,
    AnnouncementBar,
    Hero,
    BrandShowcase,
    Ticker,
    CategoryTiles,
    NewArrivals,
    CategoryShowcase,
    WholesaleBanner,
    BrandStory,
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
  private router = inject(Router);
  private queryParams = toSignal(this.route.queryParamMap);

  readonly products = this.productService.products;
  readonly loading = this.productService.loading;

  constructor() {
    // Links antigos (/?categoria=camisas) levam para a página da categoria.
    effect(() => {
      const old = this.queryParams()?.get('categoria');
      const page = old ? categoryByValue(old) : undefined;
      if (page) this.router.navigateByUrl(page.path, { replaceUrl: true });
    });

    effect(() => {
      this.titleService.setTitle(this.settingsService.settings().storeName);
    });
  }

  /** Peças marcadas como novas e com estoque, para a faixa "Chegou agora". */
  readonly newArrivals = computed(() =>
    this.products()
      .filter((p) => p.isNew && totalStock(p) > 0)
      .slice(0, 10),
  );

  readonly categoryCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const c of CATEGORY_PAGES) counts[c.value] = 0;
    for (const p of this.products()) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return counts;
  });
}
