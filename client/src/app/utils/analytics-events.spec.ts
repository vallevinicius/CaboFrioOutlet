import { describe, expect, it } from 'vitest';
import {
  TrackItem,
  buildAddToCart,
  buildBeginCheckout,
  buildPurchase,
  buildViewItem,
  parseConsent,
} from './analytics-events';

const camisa: TrackItem = { id: 'p1', name: 'Camisa', price: 89.9, quantity: 2, category: 'camisas', brand: 'Nike', size: 'M' };
const bone: TrackItem = { id: 'p2', name: 'Boné', price: 50, quantity: 1 };

describe('eventos de e-commerce', () => {
  it('view_item / ViewContent', () => {
    const e = buildViewItem(camisa);
    expect(e.ga.name).toBe('view_item');
    expect(e.ga.params['currency']).toBe('BRL');
    expect(e.ga.params['value']).toBe(179.8);
    expect((e.ga.params['items'] as Record<string, unknown>[])[0]).toMatchObject({
      item_id: 'p1',
      item_category: 'camisas',
      item_brand: 'Nike',
      item_variant: 'M',
    });
    expect(e.meta).toEqual({
      name: 'ViewContent',
      params: { content_ids: ['p1'], content_type: 'product', value: 179.8, currency: 'BRL', content_name: 'Camisa' },
    });
  });

  it('add_to_cart / AddToCart', () => {
    expect(buildAddToCart(bone).ga.name).toBe('add_to_cart');
    expect(buildAddToCart(bone).meta.name).toBe('AddToCart');
  });

  it('begin_checkout soma o carrinho e conta as unidades', () => {
    const e = buildBeginCheckout([camisa, bone]);
    expect(e.ga.params['value']).toBe(229.8);
    expect(e.meta.name).toBe('InitiateCheckout');
    expect(e.meta.params['num_items']).toBe(3);
    expect(e.meta.params['content_ids']).toEqual(['p1', 'p2']);
  });

  it('purchase usa o total e o frete do pedido e o id como transaction_id', () => {
    const e = buildPurchase('ord1', [camisa, bone], 249.7, 19.9);
    expect(e.ga.params).toMatchObject({ transaction_id: 'ord1', value: 249.7, shipping: 19.9, currency: 'BRL' });
    expect(e.meta.name).toBe('Purchase');
    expect(e.meta.params['value']).toBe(249.7);
  });

  it('item sem categoria/marca/tamanho não gera campos vazios', () => {
    const item = (buildViewItem(bone).ga.params['items'] as Record<string, unknown>[])[0];
    expect(Object.keys(item)).toEqual(['item_id', 'item_name', 'price', 'quantity']);
  });

  it('arredonda valores com centavos quebrados', () => {
    expect(buildViewItem({ id: 'x', name: 'x', price: 33.333, quantity: 3 }).ga.params['value']).toBe(100);
  });
});

describe('parseConsent', () => {
  it('só aceita granted/denied', () => {
    expect(parseConsent('granted')).toBe('granted');
    expect(parseConsent('denied')).toBe('denied');
    expect(parseConsent('yes')).toBeNull();
    expect(parseConsent(null)).toBeNull();
  });
});
