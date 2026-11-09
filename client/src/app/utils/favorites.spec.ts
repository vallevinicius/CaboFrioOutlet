import { describe, expect, it } from 'vitest';
import { MAX_FAVORITES, parseStoredFavorites, toggleId } from './favorites';

describe('parseStoredFavorites', () => {
  it('lê ids válidos e remove repetidos', () => {
    expect(parseStoredFavorites('["a1","b2","a1"]')).toEqual(['a1', 'b2']);
  });
  it('JSON quebrado, vazio ou de outro tipo vira lista vazia', () => {
    expect(parseStoredFavorites(null)).toEqual([]);
    expect(parseStoredFavorites('{quebrado')).toEqual([]);
    expect(parseStoredFavorites('{"a":1}')).toEqual([]);
  });
  it('descarta valores que não são ids seguros', () => {
    expect(parseStoredFavorites('["ok", 5, "../x", "<img>", ""]')).toEqual(['ok']);
  });
  it('limita o tamanho', () => {
    const many = JSON.stringify(Array.from({ length: MAX_FAVORITES + 50 }, (_, i) => `id${i}`));
    expect(parseStoredFavorites(many)).toHaveLength(MAX_FAVORITES);
  });
});

describe('toggleId', () => {
  it('adiciona no início e remove se já existir, sem mutar', () => {
    const base = ['a', 'b'];
    expect(toggleId(base, 'c')).toEqual({ ids: ['c', 'a', 'b'], added: true });
    expect(toggleId(base, 'a')).toEqual({ ids: ['b'], added: false });
    expect(base).toEqual(['a', 'b']);
  });
});
