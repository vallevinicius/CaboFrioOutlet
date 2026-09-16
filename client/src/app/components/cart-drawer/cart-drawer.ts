import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule, X, Minus, Plus, Trash2, ShoppingBag, Lock } from 'lucide-angular';
import { CartService, getDiscountedPrice } from '../../services/cart.service';

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Component({
  selector: 'app-cart-drawer',
  imports: [LucideAngularModule],
  templateUrl: './cart-drawer.html',
})
export class CartDrawer {
  cartService = inject(CartService);
  private router = inject(Router);

  readonly X = X;
  readonly Minus = Minus;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ShoppingBag = ShoppingBag;
  readonly Lock = Lock;
  readonly formatPrice = formatPrice;
  readonly getDiscountedPrice = getDiscountedPrice;

  handleCheckout(): void {
    this.cartService.closeCart();
    this.router.navigateByUrl('/checkout');
  }
}
