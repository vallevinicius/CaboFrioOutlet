import { describe, expect, it } from 'vitest';
import { MAX_SHOWCASE_BRANDS, showcaseBrands } from './brands';

const p = (brand?: string) => ({ brand });

describe('showcaseBrands', () => {
  it('lista cadastrada em Configurações tem prioridade', () => {
    expect(showcaseBrands(['Lacoste', 'Nike'], [p('Adidas')])).toEqual(['Lacoste', 'Nike']);
  });

  it('lista vazia: usa as marcas dos produtos, da que tem mais peças para a que tem menos', () => {
    const products = [p('Nike'), p('Lacoste'), p('Nike'), p('New Era'), p('Lacoste'), p('Nike')];
    expect(showcaseBrands([], products)).toEqual(['Nike', 'Lacoste', 'New Era']);
  });

  it('empate em número de peças: ordem alfabética', () => {
    expect(showcaseBrands([], [p('Puma'), p('Adidas')])).toEqual(['Adidas', 'Puma']);
  });

  it('não repete a mesma marca escrita diferente e ignora produto sem marca', () => {
    const products = [p('Nike'), p(' nike '), p('NIKE'), p(''), p('   '), p(undefined), p('Oakley')];
    expect(showcaseBrands([], products)).toEqual(['Nike', 'Oakley']);
  });

  it('no máximo 12 marcas', () => {
    expect(MAX_SHOWCASE_BRANDS).toBe(12);
    const products = Array.from({ length: 20 }, (_, i) => p(`Marca ${String(i).padStart(2, '0')}`));
    expect(showcaseBrands([], products)).toHaveLength(12);
  });

  it('sem lista e sem marcas nos produtos: vazio (a seção some)', () => {
    expect(showcaseBrands([], [p(undefined)])).toEqual([]);
  });
});
