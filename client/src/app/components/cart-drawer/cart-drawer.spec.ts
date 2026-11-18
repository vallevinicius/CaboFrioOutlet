import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartDrawer } from './cart-drawer';
import { CartService } from '../../services/cart.service';

function setup() {
  const fixture = TestBed.createComponent(CartDrawer);
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    panel: () => el.querySelector('aside') as HTMLElement,
    overlay: () => el.querySelector('div[aria-hidden="true"]') as HTMLElement,
  };
}

describe('CartDrawer', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  // Cada página monta a própria sacola: ao trocar de página ela é recriada. Se o HTML
  // nascesse "aberto" e só fechasse depois do binding, a transição mostrava a sacola
  // deslizando para fora a cada navegação.
  it('já nasce fechada, antes mesmo da primeira detecção de mudanças', () => {
    const { panel, overlay } = setup();
    expect(panel().classList).toContain('translate-x-full');
    expect(overlay().classList).toContain('opacity-0');
    expect(overlay().classList).toContain('pointer-events-none');
  });

  it('marca aberta e fechada conforme o carrinho', () => {
    const { fixture, panel, overlay } = setup();
    const cart = TestBed.inject(CartService);
    fixture.detectChanges();
    expect(panel().dataset['open']).toBe('false');
    expect(overlay().dataset['open']).toBe('false');

    cart.openCart();
    fixture.detectChanges();
    expect(panel().dataset['open']).toBe('true');
    expect(overlay().dataset['open']).toBe('true');

    cart.closeCart();
    fixture.detectChanges();
    expect(panel().dataset['open']).toBe('false');
  });
});
