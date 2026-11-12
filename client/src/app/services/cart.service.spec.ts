import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
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

describe('CartService: modo atacado', () => {
  let cart: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    cart = TestBed.inject(CartService);
  });

  it('compra normal NUNCA recebe desconto por quantidade, mesmo com 30 peças', () => {
    cart.addToCart(camisa, 'M');
    cart.updateQuantity('p1', 'M', 30);
    expect(cart.wholesale()).toBe(false);
    expect(cart.wholesalePercent()).toBe(0);
    expect(cart.totalPrice()).toBe(3000);
  });

  it('modo atacado aplica a faixa pela quantidade total (padrão: 10→5%, 20→10%)', () => {
    cart.startWholesale([{ product: camisa, selectedSize: 'M', quantity: 10 }]);
    expect(cart.wholesale()).toBe(true);
    expect(cart.wholesalePercent()).toBe(5);
    expect(cart.unitPrice(cart.items()[0])).toBe(95);
    expect(cart.totalPrice()).toBe(950);
    cart.updateQuantity('p1', 'M', 20);
    expect(cart.wholesalePercent()).toBe(10);
    expect(cart.totalPrice()).toBe(1800);
  });

  it('abaixo do mínimo não há desconto e o pedido não atinge o mínimo', () => {
    cart.startWholesale([{ product: camisa, selectedSize: 'M', quantity: 4 }]);
    expect(cart.meetsWholesaleMin()).toBe(false);
    expect(cart.wholesalePercent()).toBe(0);
    expect(cart.nextWholesaleTier()?.minPieces).toBe(10);
  });

  it('a promoção do produto e o desconto de atacado se somam (sobre o preço já promocional)', () => {
    cart.startWholesale([{ product: bone, selectedSize: 'M', quantity: 10 }]); // 40 com -5%
    expect(cart.unitPrice(cart.items()[0])).toBe(38);
  });

  it('sair do modo atacado ou limpar o carrinho remove o desconto', () => {
    cart.startWholesale([{ product: camisa, selectedSize: 'M', quantity: 10 }]);
    cart.leaveWholesale();
    expect(cart.totalPrice()).toBe(1000);
    cart.startWholesale([{ product: camisa, selectedSize: 'M', quantity: 10 }]);
    cart.clearCart();
    expect(cart.wholesale()).toBe(false);
    expect(cart.items()).toEqual([]);
  });

  it('ignora linhas com quantidade zero ao iniciar o atacado', () => {
    cart.startWholesale([
      { product: camisa, selectedSize: 'M', quantity: 0 },
      { product: bone, selectedSize: 'M', quantity: 10 },
    ]);
    expect(cart.items()).toHaveLength(1);
  });
});
