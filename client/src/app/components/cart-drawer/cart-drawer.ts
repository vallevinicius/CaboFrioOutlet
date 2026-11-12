import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, X, Minus, Plus, Trash2, ShoppingBag, Lock } from 'lucide-angular';
import { CartService, getDiscountedPrice } from '../../services/cart.service';
import { SettingsService } from '../../services/settings.service';
import { freeShippingProgress } from '../../utils/product-list';

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Component({
  selector: 'app-cart-drawer',
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './cart-drawer.html',
})
export class CartDrawer {
  cartService = inject(CartService);
  private router = inject(Router);
  settingsService = inject(SettingsService);

  readonly X = X;
  readonly Minus = Minus;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ShoppingBag = ShoppingBag;
  readonly Lock = Lock;
  readonly formatPrice = formatPrice;
  readonly getDiscountedPrice = getDiscountedPrice;

  readonly shippingProgress = computed(() =>
    freeShippingProgress(this.cartService.totalPrice(), this.settingsService.settings().freeShippingThreshold),
  );

  handleCheckout(): void {
    this.cartService.closeCart();
    this.router.navigateByUrl('/checkout');
  }
}
