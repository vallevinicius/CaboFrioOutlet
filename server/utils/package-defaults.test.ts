import { describe, expect, it } from 'vitest';
import { packageDefaultsFor } from './package-defaults.js';

describe('packageDefaultsFor', () => {
  it.each([
    ['camisas', { weightKg: 0.3, heightCm: 4, widthCm: 25, lengthCm: 30 }],
    ['calças', { weightKg: 0.7, heightCm: 6, widthCm: 28, lengthCm: 35 }],
    ['bermudas', { weightKg: 0.4, heightCm: 5, widthCm: 26, lengthCm: 32 }],
    ['bonés', { weightKg: 0.2, heightCm: 12, widthCm: 20, lengthCm: 25 }],
  ])('%s', (category, expected) => {
    expect(packageDefaultsFor(category)).toEqual(expected);
  });

  it('categoria desconhecida cai no padrão de camisa (nunca devolve vazio)', () => {
    expect(packageDefaultsFor('meias')).toEqual(packageDefaultsFor('camisas'));
    expect(packageDefaultsFor('')).toEqual(packageDefaultsFor('camisas'));
  });

  it('devolve uma cópia: alterar o resultado não muda o padrão', () => {
    const a = packageDefaultsFor('camisas');
    a.weightKg = 99;
    expect(packageDefaultsFor('camisas').weightKg).toBe(0.3);
  });
});
