import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Navbar } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';
import { CartDrawer } from '../../components/cart-drawer/cart-drawer';
import { StoreLocation } from '../../components/store-location/store-location';
import { SeoService } from '../../services/seo.service';
import { SettingsService } from '../../services/settings.service';
import { ProductCategory } from '../../types/product';
import { findInstitutionalPage } from '../../data/institutional-pages';

type CategoryOrAll = ProductCategory | 'todos';

@Component({
  selector: 'app-institutional-page',
  imports: [Navbar, Footer, CartDrawer, StoreLocation],
  templateUrl: './institutional-page.html',
})
export class InstitutionalPage {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private settingsService = inject(SettingsService);
  private titleService = inject(Title);
  private seo = inject(SeoService);

  readonly page = findInstitutionalPage(this.route.snapshot.data['slug']);

  activeCategory = signal<CategoryOrAll>('todos');
  searchQuery = signal('');

  constructor() {
    const title = this.page?.title ?? 'Página';
    this.titleService.setTitle(`${title} | ${this.settingsService.settings().storeName}`);
    if (this.page) this.seo.setDescription(this.page.intro);
  }

  handleCategoryChange(category: CategoryOrAll): void {
    this.router.navigate(['/'], {
      queryParams: category === 'todos' ? {} : { categoria: category },
      fragment: 'produtos',
    });
  }
}
