import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIERS,
  PricedProduct,
  currentPrice,
  discountedUnitPrice,
  normalizeTiers,
  parseTiers,
  priceWholesaleItems,
  tierFor,
} from './wholesale-pricing';

describe('normalizeTiers', () => {
  it('aceita faixas válidas e ordena por quantidade', () => {
    expect(normalizeTiers([{ minPieces: 20, discountPercent: 10 }, { minPieces: 10, discountPercent: 5 }])).toEqual([
      { minPieces: 10, discountPercent: 5 },
      { minPieces: 20, discountPercent: 10 },
    ]);
  });
  it('lista vazia é válida (sem desconto por quantidade)', () => {
    expect(normalizeTiers([])).toEqual([]);
  });
  it('arredonda o desconto para 2 casas', () => {
    expect(normalizeTiers([{ minPieces: 10, discountPercent: 7.555 }])?.[0].discountPercent).toBe(7.56);
  });
  it.each([
    ['não é lista', 'x'],
    ['item que não é objeto', [5]],
    ['quantidade quebrada', [{ minPieces: 2.5, discountPercent: 5 }]],
    ['quantidade zero', [{ minPieces: 0, discountPercent: 5 }]],
    ['quantidade enorme', [{ minPieces: 100001, discountPercent: 5 }]],
    ['desconto zero', [{ minPieces: 10, discountPercent: 0 }]],
    ['desconto negativo', [{ minPieces: 10, discountPercent: -5 }]],
    ['desconto acima de 90', [{ minPieces: 10, discountPercent: 91 }]],
    ['desconto como texto', [{ minPieces: 10, discountPercent: '5' }]],
    ['quantidade repetida', [{ minPieces: 10, discountPercent: 5 }, { minPieces: 10, discountPercent: 8 }]],
    ['mais peças com desconto igual', [{ minPieces: 10, discountPercent: 5 }, { minPieces: 20, discountPercent: 5 }]],
    ['mais peças com desconto menor', [{ minPieces: 10, discountPercent: 10 }, { minPieces: 20, discountPercent: 5 }]],
    ['faixas demais', Array.from({ length: 9 }, (_, i) => ({ minPieces: i + 1, discountPercent: i + 1 }))],
  ])('rejeita: %s', (_nome, raw) => {
    expect(normalizeTiers(raw)).toBeNull();
  });
});

describe('parseTiers', () => {
  it('nulo ou corrompido volta ao padrão; lista vazia é respeitada', () => {
    expect(parseTiers(null)).toEqual(DEFAULT_TIERS);
    expect(parseTiers('{quebrado')).toEqual(DEFAULT_TIERS);
    expect(parseTiers('[{"minPieces":1,"discountPercent":500}]')).toEqual(DEFAULT_TIERS);
    expect(parseTiers('[]')).toEqual([]);
  });
});

describe('tierFor', () => {
  const tiers = DEFAULT_TIERS; // 10→5, 20→10, 50→15
  it('devolve a maior faixa atingida', () => {
    expect(tierFor(tiers, 9)).toBeNull();
    expect(tierFor(tiers, 10)?.discountPercent).toBe(5);
    expect(tierFor(tiers, 19)?.discountPercent).toBe(5);
    expect(tierFor(tiers, 20)?.discountPercent).toBe(10);
    expect(tierFor(tiers, 49)?.discountPercent).toBe(10);
    expect(tierFor(tiers, 5000)?.discountPercent).toBe(15);
  });
  it('sem faixas, nunca há desconto', () => {
    expect(tierFor([], 100)).toBeNull();
  });
});

describe('preços', () => {
  it('discountedUnitPrice arredonda em centavos', () => {
    expect(discountedUnitPrice(99.9, 10)).toBe(89.91);
    expect(discountedUnitPrice(33.33, 15)).toBe(28.33);
    expect(discountedUnitPrice(100, 0)).toBe(100);
  });
  it('currentPrice respeita a promoção própria do produto', () => {
    expect(currentPrice({ price: 100, discountPercent: 20 })).toBe(80);
    expect(currentPrice({ price: 100, discountPercent: null })).toBe(100);
  });
});

describe('priceWholesaleItems', () => {
  const products: PricedProduct[] = [
    { id: 'a', name: 'Camisa', price: 100, discountPercent: null, sizes: ['P', 'M'] },
    { id: 'b', name: 'Boné', price: 50, discountPercent: 20, sizes: ['U'] }, // 40
  ];

  it('aplica a faixa pelo TOTAL de peças e calcula o total a partir do catálogo', () => {
    const r = priceWholesaleItems(
      [
        { productId: 'a', size: 'M', quantity: 6, unitPrice: 1 }, // preço enviado é ignorado
        { productId: 'b', size: 'U', quantity: 4 },
      ],
      products,
      DEFAULT_TIERS,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pieces).toBe(10);
    expect(r.discountPercent).toBe(5);
    expect(r.lines).toEqual([
      { productId: 'a', name: 'Camisa', size: 'M', quantity: 6, unitPrice: 95 },
      { productId: 'b', name: 'Boné', size: 'U', quantity: 4, unitPrice: 38 }, // 40 com -5% (promoção + atacado)
    ]);
    expect(r.total).toBe(6 * 95 + 4 * 38);
  });

  it('abaixo da primeira faixa não há desconto', () => {
    const r = priceWholesaleItems([{ productId: 'a', size: 'P', quantity: 3 }], products, DEFAULT_TIERS);
    expect(r.ok && r.discountPercent).toBe(0);
    expect(r.ok && r.total).toBe(300);
  });

  it('junta linhas repetidas do mesmo produto e tamanho', () => {
    const r = priceWholesaleItems(
      [{ productId: 'a', size: 'P', quantity: 5 }, { productId: 'a', size: 'P', quantity: 5 }],
      products,
      DEFAULT_TIERS,
    );
    expect(r.ok && r.lines).toHaveLength(1);
    expect(r.ok && r.pieces).toBe(10);
  });

  it.each([
    ['não é lista', 'x'],
    ['item inválido', [null]],
    ['produto inexistente', [{ productId: 'zzz', size: 'P', quantity: 1 }]],
    ['tamanho que o produto não tem', [{ productId: 'a', size: 'GG', quantity: 1 }]],
    ['quantidade zero', [{ productId: 'a', size: 'P', quantity: 0 }]],
    ['quantidade quebrada', [{ productId: 'a', size: 'P', quantity: 1.5 }]],
    ['quantidade como texto', [{ productId: 'a', size: 'P', quantity: '3' }]],
    ['linhas demais', Array.from({ length: 201 }, () => ({ productId: 'a', size: 'P', quantity: 1 }))],
  ])('rejeita: %s', (_nome, raw) => {
    expect(priceWholesaleItems(raw, products, DEFAULT_TIERS).ok).toBe(false);
  });
});
