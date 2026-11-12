import { describe, expect, it } from 'vitest';
import { ALL_PRODUCTS_PATH, CATEGORY_PAGES, categoryByPath, categoryBySlug, categoryByValue, pathForCategory } from './categories';

describe('páginas de categoria', () => {
  it('cobre as 4 categorias do catálogo, com slug sem acento e caminho coerente', () => {
    expect(CATEGORY_PAGES.map((c) => c.value)).toEqual(['camisas', 'calças', 'bermudas', 'bonés']);
    for (const c of CATEGORY_PAGES) {
      expect(c.slug, c.value).toMatch(/^[a-z]+$/);
      expect(c.path).toBe(`/${c.slug}`);
      expect(c.intro.length).toBeGreaterThan(10);
      expect(c.description.length).toBeGreaterThan(20);
    }
  });

  it('slugs e caminhos são únicos e não colidem com outras rotas', () => {
    const slugs = CATEGORY_PAGES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const reserved of ['admin', 'checkout', 'atacado', 'favoritos', 'produto', 'produtos', 'minha-conta']) {
      expect(slugs).not.toContain(reserved);
    }
  });

  it('acha a categoria por valor, slug e caminho (ignorando query, hash e barra final)', () => {
    expect(categoryByValue('calças')?.slug).toBe('calcas');
    expect(categoryBySlug('bones')?.value).toBe('bonés');
    expect(categoryByPath('/camisas')?.value).toBe('camisas');
    expect(categoryByPath('/bermudas/?busca=x#topo')?.value).toBe('bermudas');
    expect(categoryByPath('/produtos')).toBeUndefined();
    expect(categoryBySlug(undefined)).toBeUndefined();
  });

  it('pathForCategory devolve a página, ou "todos os produtos" para valor desconhecido', () => {
    expect(pathForCategory('calças')).toBe('/calcas');
    expect(pathForCategory('outra')).toBe(ALL_PRODUCTS_PATH);
  });
});
