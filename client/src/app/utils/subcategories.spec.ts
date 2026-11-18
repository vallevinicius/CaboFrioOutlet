import { describe, expect, it } from 'vitest';
import { visibleSubcategories } from './subcategories';
import { CategoryPage } from '../data/categories';

const camisas: CategoryPage = {
  id: 'cat_camisas', value: 'camisas', slug: 'camisas', path: '/camisas', label: 'Camisas', intro: '', description: '', image: '',
  subcategories: [
    { id: 'sub_basicas', slug: 'basicas', name: 'Básicas' },
    { id: 'sub_estampadas', slug: 'estampadas', name: 'Estampadas' },
    { id: 'sub_polo', slug: 'polo', name: 'Polo' },
  ],
};
const p = (category: string, subcategoryId: string | null) => ({ category, subcategoryId });

describe('visibleSubcategories', () => {
  it('só as subcategorias que têm peça, na ordem da categoria', () => {
    const products = [p('camisas', 'sub_polo'), p('camisas', 'sub_basicas'), p('camisas', null)];
    expect(visibleSubcategories(camisas, products).map((s) => s.slug)).toEqual(['basicas', 'polo']);
  });
  it('peça de outra categoria não conta', () => {
    expect(visibleSubcategories(camisas, [p('calças', 'sub_basicas')])).toEqual([]);
  });
  it('sem peças nas subcategorias, nada aparece', () => {
    expect(visibleSubcategories(camisas, [p('camisas', null)])).toEqual([]);
  });
});
