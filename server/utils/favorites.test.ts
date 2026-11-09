import { describe, expect, it } from 'vitest';
import { MAX_FAVORITES, normalizeProductIds } from './favorites';

describe('normalizeProductIds', () => {
  it('aceita ids no formato cuid, sem repetidos', () => {
    expect(normalizeProductIds(['cmu4stwin0000nknffustupxu', ' abc_123 ', 'abc_123'])).toEqual([
      'cmu4stwin0000nknffustupxu',
      'abc_123',
    ]);
  });
  it('lista vazia é válida', () => {
    expect(normalizeProductIds([])).toEqual([]);
  });
  it('rejeita não-array, tipos errados e ids com caracteres perigosos', () => {
    expect(normalizeProductIds('abc')).toBeNull();
    expect(normalizeProductIds([123])).toBeNull();
    expect(normalizeProductIds(["x'; DROP TABLE Product;--"])).toBeNull();
    expect(normalizeProductIds(['../x'])).toBeNull();
    expect(normalizeProductIds([''])).toBeNull();
    expect(normalizeProductIds(['a'.repeat(65)])).toBeNull();
  });
  it('limita o tamanho da lista', () => {
    expect(normalizeProductIds(Array.from({ length: MAX_FAVORITES + 1 }, (_, i) => `id${i}`))).toBeNull();
  });
});
