import { describe, expect, it } from 'vitest';
import { MAX_SIDE_CM, MAX_WEIGHT_KG, packageDefaultsFor, parseMeasure } from './package-defaults';

describe('packageDefaultsFor (mesma tabela do servidor)', () => {
  it.each([
    ['camisas', { weightKg: 0.3, heightCm: 4, widthCm: 25, lengthCm: 30 }],
    ['calças', { weightKg: 0.7, heightCm: 6, widthCm: 28, lengthCm: 35 }],
    ['bermudas', { weightKg: 0.4, heightCm: 5, widthCm: 26, lengthCm: 32 }],
    ['bonés', { weightKg: 0.2, heightCm: 12, widthCm: 20, lengthCm: 25 }],
  ])('%s', (category, expected) => {
    expect(packageDefaultsFor(category)).toEqual(expected);
  });
  it('categoria desconhecida cai no padrão de camisa', () => {
    expect(packageDefaultsFor('meias')).toEqual(packageDefaultsFor('camisas'));
  });
});

describe('parseMeasure', () => {
  it('aceita vírgula ou ponto como separador decimal', () => {
    expect(parseMeasure('0,35', MAX_WEIGHT_KG)).toBe(0.35);
    expect(parseMeasure('12.5', MAX_SIDE_CM)).toBe(12.5);
    expect(parseMeasure(' 7 ', MAX_SIDE_CM)).toBe(7);
  });
  it('recusa vazio, zero, negativo, texto e acima do limite', () => {
    for (const bad of ['', '  ', '0', '-2', 'abc', '1,2,3']) expect(parseMeasure(bad, MAX_SIDE_CM)).toBeNull();
    expect(parseMeasure('31', MAX_WEIGHT_KG)).toBeNull();
    expect(parseMeasure('106', MAX_SIDE_CM)).toBeNull();
    expect(parseMeasure('30', MAX_WEIGHT_KG)).toBe(30);
    expect(parseMeasure('105', MAX_SIDE_CM)).toBe(105);
  });
});
