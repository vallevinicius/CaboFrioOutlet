import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { LucideAngularModule, Heart } from 'lucide-angular';
import { Navbar } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';
import { CartDrawer } from '../../components/cart-drawer/cart-drawer';
import { ProductGrid } from '../../components/product-grid/product-grid';
import { FavoritesService } from '../../services/favorites.service';
import { ProductService } from '../../services/product.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-favorites-page',
  imports: [Navbar, Footer, CartDrawer, ProductGrid, RouterLink, LucideAngularModule],
  templateUrl: './favorites-page.html',
})
export class FavoritesPage {
  private router = inject(Router);
  private favorites = inject(FavoritesService);
  private productService = inject(ProductService);

  readonly Heart = Heart;
  readonly loading = this.productService.loading;


  /** Mantém a ordem dos favoritos (mais recentes primeiro) e ignora produtos que não existem mais. */
  readonly products = computed(() => {
    const byId = new Map(this.productService.products().map((p) => [p.id, p]));
    return this.favorites.ids().flatMap((id) => byId.get(id) ?? []);
  });

  constructor() {
    inject(Title).setTitle(`Favoritos | ${inject(SettingsService).settings().storeName}`);
  }

}
