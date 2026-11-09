import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, LogOut } from 'lucide-angular';
import { SettingsService, splitStoreName, storeInitials } from '../../../services/settings.service';
import { AuthService } from '../../../services/auth.service';
import { OverviewTab } from '../tabs/overview-tab/overview-tab';
import { BannersTab } from '../tabs/banners-tab/banners-tab';
import { ProductsTab } from '../tabs/products-tab/products-tab';
import { StockTab } from '../tabs/stock-tab/stock-tab';
import { OrdersTab } from '../tabs/orders-tab/orders-tab';
import { CustomersTab } from '../tabs/customers-tab/customers-tab';
import { SettingsTab } from '../tabs/settings-tab/settings-tab';

type TabKey = 'inicio' | 'banners' | 'produtos' | 'estoque' | 'pedidos' | 'clientes' | 'configuracoes';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'inicio', label: 'Visão geral' },
  { key: 'banners', label: 'Banners' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'configuracoes', label: 'Configurações' },
];

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, LucideAngularModule, OverviewTab, BannersTab, ProductsTab, StockTab, OrdersTab, CustomersTab, SettingsTab],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboard {
  settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly LogOut = LogOut;
  readonly tabs = TABS;
  readonly storeInitials = storeInitials;

  readonly wordmark = computed(() => splitStoreName(this.settingsService.settings().storeName));

  activeTab = signal<TabKey>('inicio');

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/');
  }
}
