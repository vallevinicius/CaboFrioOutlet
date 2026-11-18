import { describe, expect, it } from 'vitest';
import { ALL_PRODUCTS_PATH, findByPath, findBySlug, findByValue, pathForCategory, toCategoryPage } from './categories';
import { Category } from '../types/category';

const api = (key: string, slug: string, name: string, order: number): Category => ({
  id: `cat_${slug}`,
  key,
  slug,
  name,
  intro: `Frase de ${name}`,
  description: `Descrição de ${name}`,
  image: `/placeholders/cat-${slug}.jpg`,
  order,
  active: true,
});

const list = [api('camisas', 'camisas', 'Camisas', 0), api('calças', 'calcas', 'Calças', 1), api('bonés', 'bones', 'Bonés', 2)].map(toCategoryPage);

describe('páginas de categoria (vindas da API)', () => {
  it('toCategoryPage monta valor, caminho e rótulo a partir da API', () => {
    expect(list[1]).toEqual({
      id: 'cat_calcas',
      value: 'calças',
      slug: 'calcas',
      path: '/calcas',
      label: 'Calças',
      intro: 'Frase de Calças',
      description: 'Descrição de Calças',
      image: '/placeholders/cat-calcas.jpg',
    });
  });

  it('acha por valor, slug e caminho (ignorando query, hash e barra final)', () => {
    expect(findByValue(list, 'calças')?.slug).toBe('calcas');
    expect(findBySlug(list, 'bones')?.value).toBe('bonés');
    expect(findByPath(list, '/camisas')?.value).toBe('camisas');
    expect(findByPath(list, '/calcas/?busca=x#topo')?.value).toBe('calças');
    expect(findByPath(list, '/produtos')).toBeUndefined();
    expect(findBySlug(list, undefined)).toBeUndefined();
  });

  it('pathForCategory devolve a página, ou "todos os produtos" para valor desconhecido ou oculto', () => {
    expect(pathForCategory(list, 'calças')).toBe('/calcas');
    expect(pathForCategory(list, 'outra')).toBe(ALL_PRODUCTS_PATH);
  });
});
