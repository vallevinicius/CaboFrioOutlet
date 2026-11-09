import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Product } from '../types/product';
import { CartService, getDiscountedPrice } from './cart.service';

const camisa: Product = {
  id: 'p1',
  name: 'Camisa',
  price: 100,
  category: 'camisas',
  image: '/x.jpg',
  description: '',
  sizes: ['P', 'M'],
  stock: { P: 5, M: 5 },
};
const bone: Product = { ...camisa, id: 'p2', name: 'Boné', price: 50, discountPercent: 20 };

describe('getDiscountedPrice', () => {
  it('aplica o desconto percentual e ignora quando não há desconto', () => {
    expect(getDiscountedPrice(camisa)).toBe(100);
    expect(getDiscountedPrice(bone)).toBe(40);
    expect(getDiscountedPrice({ ...camisa, discountPercent: 0 })).toBe(100);
  });
});

describe('CartService', () => {
  let cart: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    cart = TestBed.inject(CartService);
  });

  it('começa vazio', () => {
    expect(cart.items()).toEqual([]);
    expect(cart.totalItems()).toBe(0);
    expect(cart.totalPrice()).toBe(0);
  });

  it('o mesmo produto no mesmo tamanho soma a quantidade; tamanho diferente é outra linha', () => {
    cart.addToCart(camisa, 'M');
    cart.addToCart(camisa, 'M');
    cart.addToCart(camisa, 'P');
    expect(cart.items()).toHaveLength(2);
    expect(cart.items().find((i) => i.selectedSize === 'M')?.quantity).toBe(2);
    expect(cart.totalItems()).toBe(3);
  });

  it('o total usa o preço com desconto', () => {
    cart.addToCart(camisa, 'M'); // 100
    cart.addToCart(bone, 'M'); // 40
    cart.addToCart(bone, 'M'); // 40
    expect(cart.totalPrice()).toBe(180);
  });

  it('atualizar a quantidade altera só a linha certa', () => {
    cart.addToCart(camisa, 'M');
    cart.addToCart(camisa, 'P');
    cart.updateQuantity('p1', 'M', 4);
    expect(cart.items().find((i) => i.selectedSize === 'M')?.quantity).toBe(4);
    expect(cart.items().find((i) => i.selectedSize === 'P')?.quantity).toBe(1);
  });

  it('quantidade zero ou negativa remove a linha', () => {
    cart.addToCart(camisa, 'M');
    cart.updateQuantity('p1', 'M', 0);
    expect(cart.items()).toEqual([]);
    cart.addToCart(camisa, 'M');
    cart.updateQuantity('p1', 'M', -2);
    expect(cart.items()).toEqual([]);
  });

  it('remover e limpar', () => {
    cart.addToCart(camisa, 'M');
    cart.addToCart(bone, 'P');
    cart.removeFromCart('p1', 'M');
    expect(cart.items().map((i) => i.product.id)).toEqual(['p2']);
    cart.removeFromCart('p2', 'G'); // tamanho que não existe: nada muda
    expect(cart.items()).toHaveLength(1);
    cart.clearCart();
    expect(cart.items()).toEqual([]);
  });

  it('abre e fecha o carrinho', () => {
    expect(cart.isCartOpen()).toBe(false);
    cart.openCart();
    expect(cart.isCartOpen()).toBe(true);
    cart.closeCart();
    expect(cart.isCartOpen()).toBe(false);
  });
});
