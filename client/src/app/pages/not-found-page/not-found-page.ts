import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Navbar } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';
import { CartDrawer } from '../../components/cart-drawer/cart-drawer';
import { SettingsService } from '../../services/settings.service';
import { ProductCategory } from '../../types/product';

type CategoryOrAll = ProductCategory | 'todos';

@Component({
  selector: 'app-not-found-page',
  imports: [Navbar, Footer, CartDrawer],
  templateUrl: './not-found-page.html',
})
export class NotFoundPage {
  private router = inject(Router);
  private settingsService = inject(SettingsService);
  private titleService = inject(Title);

  activeCategory = signal<CategoryOrAll>('todos');
  searchQuery = signal('');

  constructor() {
    this.titleService.setTitle(`Página não encontrada | ${this.settingsService.settings().storeName}`);
  }

  handleCategoryChange(category: CategoryOrAll): void {
    this.router.navigateByUrl('/');
  }

  goHome(): void {
    this.router.navigateByUrl('/');
  }
}
