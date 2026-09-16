import { Routes } from '@angular/router';
import { StorefrontPage } from './pages/storefront-page/storefront-page';
import { AdminPage } from './pages/admin-page/admin-page';
import { AccountPage } from './pages/account-page/account-page';
import { CheckoutPage } from './pages/checkout-page/checkout-page';
import { ProductPage } from './pages/product-page/product-page';
import { NotFoundPage } from './pages/not-found-page/not-found-page';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: StorefrontPage },
  { path: 'minha-conta', component: AccountPage, canActivate: [authGuard] },
  { path: 'checkout', component: CheckoutPage },
  { path: 'produto/:id', component: ProductPage },
  { path: 'admin', component: AdminPage, canActivate: [adminGuard] },
  { path: '**', component: NotFoundPage },
];
