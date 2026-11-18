import { Routes } from '@angular/router';
import { StorefrontPage } from './pages/storefront-page/storefront-page';
import { AdminPage } from './pages/admin-page/admin-page';
import { AccountPage } from './pages/account-page/account-page';
import { CheckoutPage } from './pages/checkout-page/checkout-page';
import { ProductPage } from './pages/product-page/product-page';
import { NotFoundPage } from './pages/not-found-page/not-found-page';
import { InstitutionalPage } from './pages/institutional-page/institutional-page';
import { INSTITUTIONAL_PAGES } from './data/institutional-pages';
import { FavoritesPage } from './pages/favorites-page/favorites-page';
import { WholesalePage } from './pages/wholesale-page/wholesale-page';
import { ListingPage } from './pages/listing-page/listing-page';
import { ALL_PRODUCTS_PATH } from './data/categories';
import { categoryExists } from './guards/category.guard';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: StorefrontPage },
  { path: 'minha-conta', component: AccountPage, canActivate: [authGuard] },
  { path: 'checkout', component: CheckoutPage },
  { path: 'favoritos', component: FavoritesPage },
  { path: 'atacado', component: WholesalePage },
  { path: 'produto/:id', component: ProductPage },
  { path: 'admin', component: AdminPage, canActivate: [adminGuard] },
  { path: ALL_PRODUCTS_PATH.slice(1), component: ListingPage },
  ...INSTITUTIONAL_PAGES.map((page) => ({
    path: page.slug,
    component: InstitutionalPage,
    data: { slug: page.slug },
  })),
  // Categorias vêm do painel: só casa com categoria ativa; senão segue para o 404.
  { path: ':categoria', component: ListingPage, canMatch: [categoryExists] },
  { path: '**', component: NotFoundPage },
];
