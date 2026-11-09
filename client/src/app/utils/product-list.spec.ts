import { describe, expect, it } from 'vitest';
import { Product } from '../types/product';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  availableSizes,
  filterProducts,
  freeShippingProgress,
  lowStockLabel,
  relatedProducts,
  sortProducts,
} from './product-list';

const make = (over: Partial<Product> & { id: string }): Product => ({
  name: over.id,
  price: 100,
  category: 'camisas',
  image: '/x.jpg',
  description: '',
  sizes: ['P', 'M'],
  stock: { P: 5, M: 5 },
  ...over,
});

const a = make({ id: 'a', name: 'Camisa Preta', price: 100, brand: 'Nike', isNew: true });
const b = make({ id: 'b', name: 'Calça Jeans', price: 200, category: 'calças', brand: 'Adidas', stock: { P: 0, M: 2 } });
const c = make({ id: 'c', name: 'Boné', price: 50, category: 'bonés', discountPercent: 20, sizes: ['U'], stock: { U: 0 } });
const d = make({ id: 'd', name: 'Camisa Branca', price: 150, brand: 'Nike' });
const all = [a, b, c, d];
const f = (o: Partial<typeof DEFAULT_FILTERS>) => ({ ...DEFAULT_FILTERS, ...o });

describe('filterProducts', () => {
  it('sem filtros devolve tudo', () => {
    expect(filterProducts(all, DEFAULT_FILTERS)).toHaveLength(4);
  });
  it('filtra por categoria e marca', () => {
    expect(filterProducts(all, f({ category: 'camisas' })).map((p) => p.id)).toEqual(['a', 'd']);
    expect(filterProducts(all, f({ brand: 'Adidas' })).map((p) => p.id)).toEqual(['b']);
  });
  it('tamanho só vale com estoque naquele tamanho', () => {
    expect(filterProducts(all, f({ sizes: ['P'] })).map((p) => p.id)).toEqual(['a', 'd']); // b tem P zerado
    expect(filterProducts(all, f({ sizes: ['M'] })).map((p) => p.id)).toEqual(['a', 'b', 'd']);
    expect(filterProducts(all, f({ sizes: ['P', 'U'] })).map((p) => p.id)).toEqual(['a', 'd']);
  });
  it('faixa de preço usa o preço com desconto e inclui as bordas', () => {
    expect(filterProducts(all, f({ priceMin: 40, priceMax: 40 })).map((p) => p.id)).toEqual(['c']); // 50 - 20%
    expect(filterProducts(all, f({ priceMin: 100, priceMax: 150 })).map((p) => p.id)).toEqual(['a', 'd']);
    expect(filterProducts(all, f({ priceMin: 500 }))).toEqual([]);
  });
  it('busca ignora caixa e espaços', () => {
    expect(filterProducts(all, f({ query: '  CAMISA ' })).map((p) => p.id)).toEqual(['a', 'd']);
  });
  it('combina filtros', () => {
    expect(filterProducts(all, f({ category: 'camisas', brand: 'Nike', priceMax: 120 })).map((p) => p.id)).toEqual(['a']);
  });
});

describe('sortProducts', () => {
  it('menor e maior preço, esgotados sempre por último', () => {
    expect(sortProducts(all, 'menor-preco').map((p) => p.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(sortProducts(all, 'maior-preco').map((p) => p.id)).toEqual(['b', 'd', 'a', 'c']);
  });
  it('novidades põe as marcadas como novas primeiro', () => {
    expect(sortProducts(all, 'novidades').map((p) => p.id)[0]).toBe('a');
  });
  it('relevância mantém a ordem do servidor, com esgotados no fim', () => {
    expect(sortProducts(all, 'relevancia').map((p) => p.id)).toEqual(['a', 'b', 'd', 'c']);
  });
  it('não altera a lista original', () => {
    const copy = [...all];
    sortProducts(all, 'maior-preco');
    expect(all).toEqual(copy);
  });
});

describe('outros', () => {
  it('availableSizes ignora tamanhos sem estoque e não repete', () => {
    expect(availableSizes(all)).toEqual(['P', 'M']);
  });
  it('activeFilterCount conta marca, tamanhos e preço', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount(f({ brand: 'Nike', sizes: ['P', 'M'], priceMin: 10 }))).toBe(4);
  });
  it('relatedProducts: mesma categoria, com estoque, sem a própria peça, mesma marca primeiro', () => {
    const e = make({ id: 'e', brand: 'Outra' });
    const out = relatedProducts([a, d, e, b, c], a);
    expect(out.map((p) => p.id)).toEqual(['d', 'e']);
    expect(relatedProducts([a, d, e], a, 1)).toHaveLength(1);
  });
  it('freeShippingProgress', () => {
    expect(freeShippingProgress(100, 300)).toEqual({ reached: false, remaining: 200, percent: (100 / 300) * 100 });
    expect(freeShippingProgress(300, 300)).toEqual({ reached: true, remaining: 0, percent: 100 });
    expect(freeShippingProgress(500, 300).percent).toBe(100);
    expect(freeShippingProgress(10, 0).reached).toBe(true);
  });
  it('lowStockLabel só aparece com 1 a 3 unidades', () => {
    expect(lowStockLabel(0)).toBeNull();
    expect(lowStockLabel(1)).toBe('Última unidade!');
    expect(lowStockLabel(3)).toBe('Restam só 3 unidades');
    expect(lowStockLabel(4)).toBeNull();
  });
});
