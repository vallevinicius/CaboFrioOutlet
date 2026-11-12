import { describe, expect, it } from 'vitest';
import { WholesaleTier } from '../types/settings';
import { discountedUnitPrice, formatPercent, maxDiscount, nextTier, summarizeWholesale, tierFor } from './wholesale-pricing';

const tiers: WholesaleTier[] = [
  { minPieces: 10, discountPercent: 5 },
  { minPieces: 20, discountPercent: 10 },
  { minPieces: 50, discountPercent: 15 },
];

describe('tierFor / nextTier', () => {
  it('acha a faixa atingida e a próxima', () => {
    expect(tierFor(tiers, 9)).toBeNull();
    expect(tierFor(tiers, 10)?.discountPercent).toBe(5);
    expect(tierFor(tiers, 25)?.discountPercent).toBe(10);
    expect(tierFor(tiers, 500)?.discountPercent).toBe(15);
    expect(nextTier(tiers, 0)?.minPieces).toBe(10);
    expect(nextTier(tiers, 10)?.minPieces).toBe(20);
    expect(nextTier(tiers, 50)).toBeNull();
  });
  it('lista fora de ordem funciona do mesmo jeito', () => {
    const shuffled = [tiers[2], tiers[0], tiers[1]];
    expect(tierFor(shuffled, 30)?.discountPercent).toBe(10);
    expect(nextTier(shuffled, 30)?.minPieces).toBe(50);
  });
  it('sem faixas não há desconto nem próxima', () => {
    expect(tierFor([], 99)).toBeNull();
    expect(nextTier([], 0)).toBeNull();
  });
});

describe('discountedUnitPrice', () => {
  it('arredonda em centavos como o servidor', () => {
    expect(discountedUnitPrice(99.9, 10)).toBe(89.91);
    expect(discountedUnitPrice(33.33, 15)).toBe(28.33);
  });
});

describe('summarizeWholesale', () => {
  it('abaixo do mínimo: sem desconto, informa quantas faltam', () => {
    const s = summarizeWholesale([{ price: 100, quantity: 4 }], tiers, 10);
    expect(s).toMatchObject({ pieces: 4, percent: 0, subtotal: 400, discountValue: 0, total: 400, meetsMin: false, missingForMin: 6 });
    expect(s.next).toEqual({ tier: tiers[0], missing: 6 });
  });
  it('na primeira faixa: 5% e próxima faixa a 10 peças de distância', () => {
    const s = summarizeWholesale([{ price: 100, quantity: 10 }], tiers, 10);
    expect(s).toMatchObject({ percent: 5, total: 950, discountValue: 50, meetsMin: true, missingForMin: 0 });
    expect(s.next).toEqual({ tier: tiers[1], missing: 10 });
  });
  it('mais peças, mais desconto, somando linhas diferentes', () => {
    const s = summarizeWholesale([{ price: 100, quantity: 20 }, { price: 40, quantity: 10 }], tiers, 10);
    expect(s.pieces).toBe(30);
    expect(s.percent).toBe(10);
    expect(s.subtotal).toBe(2400);
    expect(s.total).toBe(20 * 90 + 10 * 36);
  });
  it('na última faixa não há próxima', () => {
    expect(summarizeWholesale([{ price: 10, quantity: 60 }], tiers, 10).next).toBeNull();
  });
  it('carrinho vazio não quebra', () => {
    const s = summarizeWholesale([], tiers, 10);
    expect(s).toMatchObject({ pieces: 0, total: 0, percent: 0, meetsMin: false, missingForMin: 10 });
  });
});

describe('maxDiscount / formatPercent', () => {
  it('maxDiscount devolve o maior desconto, mesmo fora de ordem, e 0 sem faixas', () => {
    expect(maxDiscount(tiers)).toBe(15);
    expect(maxDiscount([tiers[2], tiers[0]])).toBe(15);
    expect(maxDiscount([])).toBe(0);
  });
  it('formatPercent usa vírgula e não deixa zeros sobrando', () => {
    expect(formatPercent(5)).toBe('5');
    expect(formatPercent(7.5)).toBe('7,5');
    expect(formatPercent(12.345)).toBe('12,35');
  });
});
