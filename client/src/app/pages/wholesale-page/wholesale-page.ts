import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { LucideAngularModule, MessageCircle, Check } from 'lucide-angular';
import { WholesaleHeader } from '../../components/wholesale-header/wholesale-header';
import { Footer } from '../../components/footer/footer';
import { CartDrawer } from '../../components/cart-drawer/cart-drawer';
import { SettingsService } from '../../services/settings.service';
import { ProductService } from '../../services/product.service';
import { CartService, getDiscountedPrice } from '../../services/cart.service';
import { SeoService } from '../../services/seo.service';
import { WholesaleService } from '../../services/wholesale.service';
import { ApiError } from '../../services/api-error';
import { ProductCategory } from '../../types/product';
import { formatCnpj } from '../../utils/cnpj';
import { formatPhone } from '../../utils/phone';
import { whatsappUrl } from '../../utils/whatsapp';
import { DEFAULT_FILTERS, filterProducts, totalStock } from '../../utils/product-list';
import { discountedUnitPrice, formatPercent, maxDiscount, summarizeWholesale } from '../../utils/wholesale-pricing';
import { Product } from '../../types/product';

type CategoryOrAll = ProductCategory | 'todos';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: 'camisas', label: 'Camisas' },
  { value: 'calças', label: 'Calças' },
  { value: 'bermudas', label: 'Bermudas' },
  { value: 'bonés', label: 'Bonés' },
];

@Component({
  selector: 'app-wholesale-page',
  imports: [LucideAngularModule, WholesaleHeader, Footer, CartDrawer],
  templateUrl: './wholesale-page.html',
})
export class WholesalePage implements OnDestroy {
  private meta = inject(Meta);
  private router = inject(Router);
  private settingsService = inject(SettingsService);
  private wholesale = inject(WholesaleService);
  private productService = inject(ProductService);
  private cartService = inject(CartService);

  readonly MessageCircle = MessageCircle;
  readonly Check = Check;
  readonly ufs = UFS;
  readonly Math = Math;
  readonly getDiscountedPrice = getDiscountedPrice;
  readonly categoryOptions = CATEGORY_OPTIONS;

  readonly settings = this.settingsService.settings;
  readonly minPieces = computed(() => this.settings().wholesaleMinPieces);
  readonly notes = computed(() => this.settings().wholesaleNotes.split('\n').map((l) => l.trim()).filter(Boolean));
  readonly brands = computed(() => this.settings().brands);
  readonly whatsappLink = computed(() =>
    whatsappUrl(this.settings().whatsapp, 'Olá! Tenho uma loja e gostaria de saber mais sobre o atacado.'),
  );

  // ── Montagem do pedido ──
  readonly PAGE_SIZE = 12;
  readonly products = this.productService.products;
  readonly productsLoading = this.productService.loading;
  readonly tiers = computed(() => this.settings().wholesaleTiers);

  pickerQuery = signal('');
  pickerCategory = signal<CategoryOrAll>('todos');
  visibleCount = signal(this.PAGE_SIZE);
  /** productId → tamanho → quantidade escolhida. */
  selection = signal<Record<string, Record<string, number>>>({});

  readonly pickerProducts = computed(() =>
    filterProducts(this.products().filter((p) => totalStock(p) > 0), {
      ...DEFAULT_FILTERS,
      category: this.pickerCategory(),
      query: this.pickerQuery(),
    }),
  );
  readonly visiblePickerProducts = computed(() => this.pickerProducts().slice(0, this.visibleCount()));

  /** Linhas escolhidas (busca no catálogo inteiro, então sobrevivem a mudanças de filtro). */
  readonly lines = computed(() => {
    const byId = new Map(this.products().map((p) => [p.id, p]));
    const out: { product: Product; selectedSize: string; quantity: number; price: number }[] = [];
    for (const [productId, sizes] of Object.entries(this.selection())) {
      const product = byId.get(productId);
      if (!product) continue;
      for (const [size, quantity] of Object.entries(sizes)) {
        if (quantity > 0) out.push({ product, selectedSize: size, quantity, price: getDiscountedPrice(product) });
      }
    }
    return out;
  });
  readonly summary = computed(() =>
    summarizeWholesale(this.lines().map((l) => ({ price: l.price, quantity: l.quantity })), this.tiers(), this.minPieces()),
  );

  money(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  quantityOf(productId: string, size: string): number {
    return this.selection()[productId]?.[size] ?? 0;
  }

  setQuantity(product: Product, size: string, value: number): void {
    const max = product.stock[size] ?? 0;
    const qty = Math.max(0, Math.min(max, Number.isFinite(value) ? Math.floor(value) : 0));
    this.selection.update((prev) => {
      const sizes = { ...(prev[product.id] ?? {}) };
      if (qty > 0) sizes[size] = qty;
      else delete sizes[size];
      const next = { ...prev, [product.id]: sizes };
      if (Object.keys(sizes).length === 0) delete next[product.id];
      return next;
    });
  }

  /** Preço unitário que o cliente pagaria hoje com a faixa atual (para mostrar no seletor). */
  wholesalePrice(product: Product): number {
    return discountedUnitPrice(getDiscountedPrice(product), this.summary().percent);
  }

  showMore(): void {
    this.visibleCount.update((n) => n + this.PAGE_SIZE);
  }

  setPickerQuery(value: string): void {
    this.pickerQuery.set(value);
    this.visibleCount.set(this.PAGE_SIZE);
  }

  setPickerCategory(category: CategoryOrAll): void {
    this.pickerCategory.set(category);
    this.visibleCount.set(this.PAGE_SIZE);
  }

  clearSelection(): void {
    this.selection.set({});
  }

  /** Leva o pedido montado para o carrinho em modo atacado e abre o checkout. */
  payNow(): void {
    if (!this.summary().meetsMin) return;
    this.cartService.startWholesale(this.lines().map((l) => ({ product: l.product, selectedSize: l.selectedSize, quantity: l.quantity })));
    this.router.navigateByUrl('/checkout');
  }

  goToQuote(): void {
    document.getElementById('orcamento')?.scrollIntoView({ behavior: 'smooth' });
  }

  name = signal('');
  company = signal('');
  cnpj = signal('');
  phone = signal('');
  email = signal('');
  city = signal('');
  state = signal('RJ');
  interests = signal<ProductCategory[]>([]);
  estimatedPieces = signal('');
  message = signal('');
  consent = signal(false);
  website = signal(''); // campo-isca

  submitting = signal(false);
  error = signal('');
  sent = signal(false);

  readonly topDiscount = computed(() => formatPercent(maxDiscount(this.tiers())));
  readonly firstDiscount = computed(() => formatPercent(this.tiers()[0]?.discountPercent ?? 0));

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  constructor() {
    // Barra do navegador do celular acompanha o tema escuro da área de atacado.
    this.meta.updateTag({ name: 'theme-color', content: '#000000' });
    const title = `Atacado | ${this.settingsService.settings().storeName}`;
    inject(Title).setTitle(title);
    inject(SeoService).setDescription(
      'Compre moda urbana no atacado em Cabo Frio: camisas, calças, bermudas e bonés. Peça um orçamento para a sua loja.',
    );
  }

  ngOnDestroy(): void {
    this.meta.updateTag({ name: 'theme-color', content: '#FFC700' });
  }

  onCnpjInput(value: string): void {
    this.cnpj.set(formatCnpj(value));
  }

  onPhoneInput(value: string): void {
    this.phone.set(formatPhone(value));
  }

  toggleInterest(value: ProductCategory): void {
    this.interests.update((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;
    this.error.set('');
    this.submitting.set(true);
    try {
      const pieces = parseInt(this.estimatedPieces(), 10);
      await this.wholesale.submitQuote({
        name: this.name(),
        company: this.company(),
        cnpj: this.cnpj(),
        phone: this.phone(),
        email: this.email(),
        city: this.city(),
        state: this.state(),
        interests: this.interests(),
        estimatedPieces: Number.isFinite(pieces) && pieces > 0 ? pieces : null,
        message: this.message(),
        items: this.lines().map((l) => ({ productId: l.product.id, size: l.selectedSize, quantity: l.quantity })),
        consent: this.consent(),
        website: this.website(),
      });
      this.sent.set(true);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Não foi possível enviar agora. Tente de novo em instantes.');
    } finally {
      this.submitting.set(false);
    }
  }

  newRequest(): void {
    this.sent.set(false);
    this.message.set('');
    this.selection.set({});
  }
}
