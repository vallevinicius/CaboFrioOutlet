import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

// Mesmo comportamento de server/utils/category-slug.ts (lá é a regra que vale; aqui é só a prévia).
describe('slugify (prévia do endereço da categoria)', () => {
  it('tira acento, troca espaço e símbolo por hífen e deixa minúsculo', () => {
    expect(slugify('Camisas Polo Ção')).toBe('camisas-polo-cao');
    expect(slugify('  Moletons & Jaquetas!! ')).toBe('moletons-jaquetas');
    expect(slugify('Tênis---Casual')).toBe('tenis-casual');
  });
  it('sem letras nem números fica vazio', () => {
    expect(slugify('!!!')).toBe('');
  });
  it('no máximo 60 caracteres, sem hífen no fim', () => {
    const s = slugify(`${'a'.repeat(59)} bb`);
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });
});
