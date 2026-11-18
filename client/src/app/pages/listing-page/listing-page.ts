import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Navbar } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';
import { CartDrawer } from '../../components/cart-drawer/cart-drawer';
import { ProductToolbar } from '../../components/product-toolbar/product-toolbar';
import { ProductGrid } from '../../components/product-grid/product-grid';
import { ProductService } from '../../services/product.service';
import { SettingsService } from '../../services/settings.service';
import { SearchService } from '../../services/search.service';
import { SeoService } from '../../services/seo.service';
import { ALL_PRODUCTS_PATH } from '../../data/categories';
import { CategoryService } from '../../services/category.service';
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  SortKey,
  availableSizes,
  filterProducts,
  sortProducts,
} from '../../utils/product-list';

/** Página de uma categoria (/camisas, /calcas...) ou de todos os produtos (/produtos, também usada pela busca e por marca). */
@Component({
  selector: 'app-listing-page',
  imports: [Navbar, Footer, CartDrawer, ProductToolbar, ProductGrid, RouterLink],
  templateUrl: './listing-page.html',
})
export class ListingPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private settingsService = inject(SettingsService);
  private titleService = inject(Title);
  private seo = inject(SeoService);
  readonly search = inject(SearchService);

  private categoryService = inject(CategoryService);
  readonly categories = this.categoryService.categories;
  readonly allPath = ALL_PRODUCTS_PATH;

  private params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  /** Categoria da página atual; indefinida em /produtos. */
  readonly category = computed(() => this.categoryService.bySlug(this.params().get('categoria') ?? undefined));
  readonly title = computed(() => this.category()?.label ?? 'Todos os produtos');
  readonly intro = computed(
    () => this.category()?.intro || 'Tudo o que a loja tem, com preço de outlet.',
  );

  readonly loading = this.productService.loading;
  readonly brands = computed(() => this.settingsService.settings().brands);

  sort = signal<SortKey>('relevancia');
  brand = signal<string>('todos');
  sizes = signal<string[]>([]);
  priceMin = signal<number | null>(null);
  priceMax = signal<number | null>(null);
  visibleCount = signal(PAGE_SIZE);

  /** Produtos da categoria (antes dos filtros): usados para os tamanhos e para o contador. */
  private inScope = computed(() => {
    const c = this.category();
    const all = this.productService.retailProducts();
    return c ? all.filter((p) => p.category === c.value) : all;
  });
  readonly sizeOptions = computed(() => availableSizes(this.inScope()));

  readonly filtered = computed(() =>
    sortProducts(
      filterProducts(this.inScope(), {
        ...DEFAULT_FILTERS,
        brand: this.brand(),
        sizes: this.sizes(),
        priceMin: this.priceMin(),
        priceMax: this.priceMax(),
        query: this.search.query(),
        sort: this.sort(),
      }),
      this.sort(),
    ),
  );
  readonly visible = computed(() => this.filtered().slice(0, this.visibleCount()));
  readonly hasMore = computed(() => this.filtered().length > this.visibleCount());

  constructor() {
    // Marca (?marca=Nike) e busca (?busca=camisa) vindas da URL.
    effect(() => {
      const params = this.queryParams();
      const marca = params.get('marca');
      const busca = params.get('busca');
      untracked(() => {
        this.brand.set(marca ?? 'todos');
        if (busca !== null && busca !== this.search.query()) this.search.set(busca);
      });
    });

    effect(() => {
      const title = this.title();
      this.titleService.setTitle(`${title} | ${this.settingsService.settings().storeName}`);
      const c = this.category();
      this.seo.setDescription(c ? c.description || `${c.label} multimarcas em Cabo Frio, com preço de outlet.` : 'Roupas multimarcas com preço de outlet em Cabo Frio.');
    });

    // Qualquer mudança de filtro volta para a primeira página.
    effect(() => {
      this.category();
      this.brand();
      this.sizes();
      this.priceMin();
      this.priceMax();
      this.search.query();
      this.sort();
      untracked(() => this.visibleCount.set(PAGE_SIZE));
    });
  }

  loadMore(): void {
    this.visibleCount.update((n) => n + PAGE_SIZE);
  }

  clearSearch(): void {
    this.search.clear();
    this.router.navigate([], { queryParams: { busca: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
