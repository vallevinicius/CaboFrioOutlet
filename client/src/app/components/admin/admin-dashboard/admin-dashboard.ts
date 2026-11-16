import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  LogOut,
  LayoutDashboard,
  Images,
  Shirt,
  Package,
  ShoppingBag,
  Store,
  Users,
  Settings,
  ShieldCheck,
  Menu,
  X,
  ExternalLink,
} from 'lucide-angular';
import { SettingsService, splitStoreName, storeInitials } from '../../../services/settings.service';
import { AuthService } from '../../../services/auth.service';
import { Section } from '../../../utils/permissions';
import { OverviewTab } from '../tabs/overview-tab/overview-tab';
import { BannersTab } from '../tabs/banners-tab/banners-tab';
import { ProductsTab } from '../tabs/products-tab/products-tab';
import { StockTab } from '../tabs/stock-tab/stock-tab';
import { WholesaleTab } from '../tabs/wholesale-tab/wholesale-tab';
import { OrdersTab } from '../tabs/orders-tab/orders-tab';
import { CustomersTab } from '../tabs/customers-tab/customers-tab';
import { SettingsTab } from '../tabs/settings-tab/settings-tab';
import { StaffTab } from '../tabs/staff-tab/staff-tab';

type TabKey = Section | 'equipe';

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof LayoutDashboard;
}

const TABS: TabDef[] = [
  { key: 'inicio', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'banners', label: 'Banners', icon: Images },
  { key: 'produtos', label: 'Produtos', icon: Shirt },
  { key: 'estoque', label: 'Estoque', icon: Package },
  { key: 'pedidos', label: 'Pedidos', icon: ShoppingBag },
  { key: 'atacado', label: 'Atacado', icon: Store },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'configuracoes', label: 'Configurações', icon: Settings },
];

const TEAM_TAB: TabDef = { key: 'equipe', label: 'Equipe', icon: ShieldCheck };

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, LucideAngularModule, OverviewTab, BannersTab, ProductsTab, StockTab, OrdersTab, WholesaleTab, CustomersTab, SettingsTab, StaffTab],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboard {
  settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly LogOut = LogOut;
  readonly MenuIcon = Menu;
  readonly CloseIcon = X;
  readonly ExternalLink = ExternalLink;
  readonly storeInitials = storeInitials;

  readonly user = this.authService.user;
  readonly isSuperAdmin = this.authService.isSuperAdmin;
  readonly wordmark = computed(() => splitStoreName(this.settingsService.settings().storeName));

  /** Só as telas em que o perfil tem ao menos "ver". */
  readonly visibleTabs = computed(() => TABS.filter((t) => this.authService.can(t.key as Section, 'view')));
  readonly teamTab = TEAM_TAB;
  readonly roleLabel = computed(() => (this.isSuperAdmin() ? 'Admin supremo' : 'Equipe'));

  activeTab = signal<TabKey | null>(null);
  menuOpen = signal(false);

  constructor() {
    // Mantém sempre uma aba válida: a primeira liberada, ou nenhuma se o perfil não tem telas.
    effect(() => {
      const current = this.activeTab();
      const allowed = this.visibleTabs().map((t) => t.key);
      const stillValid = current !== null && (allowed.includes(current) || (current === 'equipe' && this.isSuperAdmin()));
      if (!stillValid) this.activeTab.set(allowed[0] ?? null);
    });
  }

  select(tab: TabKey): void {
    this.activeTab.set(tab);
    this.menuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/');
  }
}
