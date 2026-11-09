import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { ProductCategory } from '../../types/product';
import { RegisterModal } from '../register-modal/register-modal';

type CategoryOrAll = ProductCategory | 'todos';

const CATEGORIES: { label: string; value: ProductCategory }[] = [
  { label: 'Camisas', value: 'camisas' },
  { label: 'Calças', value: 'calças' },
  { label: 'Bermudas', value: 'bermudas' },
  { label: 'Bonés', value: 'bonés' },
];

const WHATSAPP_URL = 'https://wa.me/5522992198824';
const INSTAGRAM_URL = 'https://www.instagram.com/cabofrio.outlet';
const CORREIOS_TRACKING_URL = 'https://rastreamento.correios.com.br/app/index.php';

@Component({
  selector: 'app-navbar',
  imports: [LucideAngularModule, RouterLink, RegisterModal],
  templateUrl: './navbar.html',
})
export class Navbar {
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
  readonly categories = CATEGORIES;
  readonly storeInitials = storeInitials;
  readonly whatsappUrl = WHATSAPP_URL;
  readonly instagramUrl = INSTAGRAM_URL;
  readonly correiosTrackingUrl = CORREIOS_TRACKING_URL;

  activeCategory = input.required<CategoryOrAll>();
  categoryChange = output<CategoryOrAll>();
  searchQuery = input.required<string>();
  searchChange = output<string>();

  mobileMenuOpen = signal(false);
  searchOpen = signal(false);
  accountMenuOpen = signal(false);
  registerModalOpen = signal(false);

  authError = signal('');
  authSubmitting = signal(false);

  loginEmail = signal('');
  loginPassword = signal('');

  readonly wordmark = computed(() => splitStoreName(this.settingsService.settings().storeName));

  handleCategoryClick(category: CategoryOrAll): void {
    this.categoryChange.emit(category);
    this.mobileMenuOpen.set(false);
    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
  }

  handleHomeClick(): void {
    this.categoryChange.emit('todos');
    this.mobileMenuOpen.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleSearch(): void {
    const willOpen = !this.searchOpen();
    if (!willOpen) this.searchChange.emit('');
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
