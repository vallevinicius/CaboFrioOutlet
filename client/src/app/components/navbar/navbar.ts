import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import {
  LucideAngularModule,
  ShoppingBag,
  Menu,
  X,
  Search,
  User,
  MessageCircle,
  Truck,
  Instagram,
  ShieldCheck,
  Heart,
} from 'lucide-angular';
import { FavoritesService } from '../../services/favorites.service';
import { CartService } from '../../services/cart.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { ApiError } from '../../services/api-error';
import { SettingsService, splitStoreName, storeInitials } from '../../services/settings.service';
import { SearchService } from '../../services/search.service';
import { ALL_PRODUCTS_PATH } from '../../data/categories';
import { CategoryService } from '../../services/category.service';
import { formatPercent, maxDiscount } from '../../utils/wholesale-pricing';
import { RegisterModal } from '../register-modal/register-modal';

const WHATSAPP_URL = 'https://wa.me/5522992198824';
const INSTAGRAM_URL = 'https://www.instagram.com/cabofrio.outlet';
const CORREIOS_TRACKING_URL = 'https://rastreamento.correios.com.br/app/index.php';

@Component({
  selector: 'app-navbar',
  imports: [LucideAngularModule, RouterLink, RegisterModal],
  templateUrl: './navbar.html',
})
export class Navbar {
  /** Pulinho no ícone do carrinho quando entra uma peça (feedback do "adicionar"). */
  cartBump = signal(false);
  private lastCartCount = 0;
  private cartBumpTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const count = this.cartService.totalItems();
      if (count > this.lastCartCount) {
        clearTimeout(this.cartBumpTimer);
        this.cartBump.set(false);
        // um tick depois, para a animação reiniciar mesmo em cliques seguidos
        setTimeout(() => {
          this.cartBump.set(true);
          this.cartBumpTimer = setTimeout(() => this.cartBump.set(false), 500);
        }, 0);
      }
      this.lastCartCount = count;
    });
  }

  cartService = inject(CartService);
  private toastService = inject(ToastService);
  settingsService = inject(SettingsService);
  favoritesService = inject(FavoritesService);
  readonly Heart = Heart;
  authService = inject(AuthService);

  readonly ShoppingBag = ShoppingBag;
  readonly Menu = Menu;
  readonly X = X;
  readonly Search = Search;
  readonly User = User;
  readonly MessageCircle = MessageCircle;
  readonly Truck = Truck;
  readonly Instagram = Instagram;
  readonly ShieldCheck = ShieldCheck;
  private categoryService = inject(CategoryService);
  readonly categories = this.categoryService.categories;
  readonly storeInitials = storeInitials;
  readonly whatsappUrl = WHATSAPP_URL;
  readonly instagramUrl = INSTAGRAM_URL;
  readonly correiosTrackingUrl = CORREIOS_TRACKING_URL;

  private router = inject(Router);
  private search = inject(SearchService);

  readonly searchQuery = this.search.query;

  /** Caminho atual (sem query/hash), para destacar a página em que o cliente está. */
  private currentPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );
  readonly isHome = computed(() => this.currentPath() === '/');
  readonly activeCategory = computed(() => this.categoryService.byPath(this.currentPath())?.value ?? null);

  /** Ex.: "até 15% off" — vem das faixas de atacado do admin. */
  readonly wholesaleBadge = computed(() => {
    const top = maxDiscount(this.settingsService.settings().wholesaleTiers);
    return top > 0 ? `até ${formatPercent(top)}% off` : '';
  });

  mobileMenuOpen = signal(false);
  searchOpen = signal(false);
  accountMenuOpen = signal(false);
  registerModalOpen = signal(false);

  authError = signal('');
  authSubmitting = signal(false);

  loginEmail = signal('');
  loginPassword = signal('');
  showPassword = signal(false);

  readonly wordmark = computed(() => splitStoreName(this.settingsService.settings().storeName));

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  /** Nas páginas de listagem a busca filtra ali mesmo; nas demais, leva para /produtos com o termo. */
  onSearchInput(value: string): void {
    this.search.set(value);
    const path = this.currentPath();
    const onListing = path === ALL_PRODUCTS_PATH || this.categoryService.byPath(path) !== undefined;
    if (!onListing && value.trim() !== '') {
      this.router.navigate([ALL_PRODUCTS_PATH], { queryParams: { busca: value } });
    }
  }

  clearSearch(): void {
    this.search.clear();
  }

  toggleSearch(): void {
    const willOpen = !this.searchOpen();
    if (!willOpen) this.clearSearch();
    this.searchOpen.set(willOpen);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  toggleAccountMenu(): void {
    this.authError.set('');
    this.accountMenuOpen.update((v) => !v);
  }

  openRegisterModal(): void {
    this.accountMenuOpen.set(false);
    this.registerModalOpen.set(true);
  }

  async handleLoginSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.authSubmitting.set(true);
    this.authError.set('');
    try {
      await this.authService.login(this.loginEmail(), this.loginPassword());
      this.loginEmail.set('');
      this.loginPassword.set('');
      this.accountMenuOpen.set(false);
      this.toastService.showToast('Login realizado', 'Bem-vindo de volta!');
    } catch (err) {
      this.authError.set(err instanceof ApiError ? err.message : 'Não foi possível entrar.');
    } finally {
      this.authSubmitting.set(false);
    }
  }

  handleLogout(): void {
    this.authService.logout();
    this.accountMenuOpen.set(false);
  }
}
