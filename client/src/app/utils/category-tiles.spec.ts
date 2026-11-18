import { describe, expect, it } from 'vitest';
import { tileLayout } from './category-tiles';

const BIG = { layout: 'col-span-2 row-span-2', titleSize: 'text-5xl sm:text-6xl lg:text-8xl' };
const SMALL = { layout: 'col-span-1', titleSize: 'text-3xl sm:text-5xl' };
const WIDE = { layout: 'col-span-2', titleSize: 'text-4xl sm:text-6xl' };

const all = (total: number) => Array.from({ length: total }, (_, i) => tileLayout(i, total));
/** Colunas ocupadas no desktop (grade de 4). */
const lgSpan = (layout: string) => {
  const lg = layout.match(/lg:col-span-(\d)/);
  if (lg) return Number(lg[1]);
  return Number(layout.match(/(?:^| )col-span-(\d)/)![1]);
};
const lgRows = (layout: string) => (layout.includes('row-span-2') ? 2 : 1);

describe('tileLayout (quadros de "Escolha o seu estilo")', () => {
  it('com 4 categorias, mantém exatamente o desenho atual', () => {
    expect(all(4)).toEqual([BIG, SMALL, SMALL, WIDE]);
  });

  it('o desenho se repete a cada 4', () => {
    expect(all(8)).toEqual([BIG, SMALL, SMALL, WIDE, BIG, SMALL, SMALL, WIDE]);
  });

  it('1 sobrando ocupa a linha toda', () => {
    expect(all(5)[4]).toEqual({ layout: 'col-span-2 lg:col-span-4', titleSize: 'text-4xl sm:text-6xl' });
  });

  it('2 sobrando dividem a linha', () => {
    expect(all(6).slice(4)).toEqual([
      { layout: 'col-span-1 lg:col-span-2', titleSize: 'text-3xl sm:text-5xl' },
      { layout: 'col-span-1 lg:col-span-2', titleSize: 'text-3xl sm:text-5xl' },
    ]);
  });

  it('3 sobrando: um largo e dois pequenos', () => {
    expect(all(7).slice(4)).toEqual([{ layout: 'col-span-2 lg:col-span-2', titleSize: 'text-4xl sm:text-6xl' }, SMALL, SMALL]);
  });

  it('no desktop (4 colunas) a grade fecha sem buracos, de 1 a 12 categorias', () => {
    for (let total = 1; total <= 12; total++) {
      const cells = all(total).reduce((sum, t) => sum + lgSpan(t.layout) * lgRows(t.layout), 0);
      expect(cells % 4, `${total} categorias`).toBe(0);
    }
  });

  it('menos de 4 categorias usa só a regra da sobra', () => {
    expect(all(1)).toEqual([{ layout: 'col-span-2 lg:col-span-4', titleSize: 'text-4xl sm:text-6xl' }]);
    expect(all(3)[0].layout).toBe('col-span-2 lg:col-span-2');
  });
});
