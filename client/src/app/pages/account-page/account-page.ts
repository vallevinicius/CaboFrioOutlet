import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  LucideAngularModule,
  Package,
  User,
  MapPin,
  LogOut,
  ChevronDown,
  ChevronUp,
} from 'lucide-angular';
import { Navbar } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';
import { CartDrawer } from '../../components/cart-drawer/cart-drawer';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { ApiError } from '../../services/api-error';
import { Order } from '../../types/order';
import { ProductCategory } from '../../types/product';
import {
  formatInstallments,
  formatOrderDate,
  formatOrderPrice,
  formatPaymentMethod,
  STATUS_LABELS,
  STATUS_STYLES,
} from '../../utils/order-format';
import { formatPhone } from '../../utils/phone';
import { formatCep } from '../../utils/cep';

type CategoryOrAll = ProductCategory | 'todos';
type Section = 'pedidos' | 'dados' | 'enderecos';

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

@Component({
  selector: 'app-account-page',
  imports: [LucideAngularModule, Navbar, Footer, CartDrawer],
  templateUrl: './account-page.html',
})
export class AccountPage implements OnInit {
  private api = inject(ApiService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private settingsService = inject(SettingsService);
  private titleService = inject(Title);
  authService = inject(AuthService);

  readonly Package = Package;
  readonly User = User;
  readonly MapPin = MapPin;
  readonly LogOut = LogOut;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly statusLabels = STATUS_LABELS;
  readonly statusStyles = STATUS_STYLES;
  readonly formatPrice = formatOrderPrice;
  readonly formatDate = formatOrderDate;
  readonly formatPaymentMethod = formatPaymentMethod;
  readonly formatInstallments = formatInstallments;

  // navbar precisa desses inputs, mas essa página não filtra produtos
  activeCategory = signal<CategoryOrAll>('todos');
  searchQuery = signal('');

  section = signal<Section>('pedidos');

  orders = signal<Order[]>([]);
  ordersLoading = signal(true);
  expandedOrderId = signal<string | null>(null);

  name = signal('');
  email = signal('');
  phone = signal('');
  cep = signal('');
  street = signal('');
  number = signal('');
  complement = signal('');
  neighborhood = signal('');
  city = signal('');
  state = signal('');
  cepLookupState = signal<'idle' | 'loading' | 'not-found'>('idle');
  savingProfile = signal(false);

  constructor() {
    this.titleService.setTitle(`Minha conta | ${this.settingsService.settings().storeName}`);
  }

  ngOnInit(): void {
    this.loadOrders();
    this.resetFormFromUser();
  }

  private resetFormFromUser(): void {
    const user = this.authService.user();
    if (!user) return;
    this.name.set(user.name);
    this.email.set(user.email);
    this.phone.set(formatPhone(user.phone));
    this.cep.set(formatCep(user.cep));
    this.street.set(user.street);
    this.number.set(user.number);
    this.complement.set(user.complement ?? '');
    this.neighborhood.set(user.neighborhood);
    this.city.set(user.city);
    this.state.set(user.state);
  }

  private loadOrders(): void {
    this.ordersLoading.set(true);
    this.api
      .get<Order[]>('/orders/mine')
      .then((data) => this.orders.set(data))
      .catch((err) =>
        this.toastService.showToast('Erro ao carregar pedidos', err instanceof ApiError ? err.message : undefined)
      )
      .finally(() => this.ordersLoading.set(false));
  }

  toggleOrder(orderId: string): void {
    this.expandedOrderId.update((current) => (current === orderId ? null : orderId));
  }

  onPhoneInput(value: string): void {
    this.phone.set(formatPhone(value));
  }

  onCepInput(value: string): void {
    const formatted = formatCep(value);
    this.cep.set(formatted);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      this.lookupCep(digits);
    }
  }

  private async lookupCep(digits: string): Promise<void> {
    this.cepLookupState.set('loading');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: ViaCepResponse = await res.json();
      if (data.erro) {
        this.cepLookupState.set('not-found');
        return;
      }
      this.street.set(data.logradouro ?? '');
      this.neighborhood.set(data.bairro ?? '');
      this.city.set(data.localidade ?? '');
      this.state.set(data.uf ?? '');
      this.cepLookupState.set('idle');
    } catch {
      this.cepLookupState.set('not-found');
    }
  }

  async handleProfileSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.savingProfile.set(true);
    try {
      await this.authService.updateProfile({
        name: this.name().trim(),
        email: this.email().trim(),
        phone: this.phone().trim(),
        cep: this.cep(),
        street: this.street().trim(),
        number: this.number().trim(),
        complement: this.complement().trim() || undefined,
        neighborhood: this.neighborhood().trim(),
        city: this.city().trim(),
        state: this.state().trim(),
      });
      this.toastService.showToast('Dados atualizados!');
    } catch (err) {
      this.toastService.showToast('Erro ao atualizar dados', err instanceof ApiError ? err.message : undefined);
    } finally {
      this.savingProfile.set(false);
    }
  }

  handleCategoryChange(): void {
    this.router.navigateByUrl('/');
  }

  handleLogout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/');
  }
}
