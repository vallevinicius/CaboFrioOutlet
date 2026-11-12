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
import { CATEGORY_PAGES, ALL_PRODUCTS_PATH } from './data/categories';
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
  ...CATEGORY_PAGES.map((c) => ({ path: c.slug, component: ListingPage, data: { slug: c.slug } })),
  ...INSTITUTIONAL_PAGES.map((page) => ({
    path: page.slug,
    component: InstitutionalPage,
    data: { slug: page.slug },
  })),
  { path: '**', component: NotFoundPage },
];
