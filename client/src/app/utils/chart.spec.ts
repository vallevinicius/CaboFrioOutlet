import { describe, expect, it } from 'vitest';
import { barGeometry } from './chart';

describe('barGeometry', () => {
  it('a maior barra ocupa a altura toda e as outras são proporcionais', () => {
    const bars = barGeometry([0, 50, 100], 300, 100, 0);
    expect(bars).toHaveLength(3);
    expect(bars[2]).toMatchObject({ y: 0, height: 100, width: 100 });
    expect(bars[1].height).toBe(50);
    expect(bars[1].y).toBe(50);
  });
  it('valor zero ganha 1px e valor mínimo positivo ganha 2px (visíveis)', () => {
    const bars = barGeometry([0, 1, 1000], 90, 100);
    expect(bars[0].height).toBe(1);
    expect(bars[1].height).toBe(2);
  });
  it('todos zeros não gera NaN', () => {
    const bars = barGeometry([0, 0], 100, 50);
    expect(bars.every((b) => Number.isFinite(b.height) && b.height === 1)).toBe(true);
  });
  it('entradas vazias ou áreas inválidas devolvem lista vazia', () => {
    expect(barGeometry([], 100, 100)).toEqual([]);
    expect(barGeometry([1], 0, 100)).toEqual([]);
  });
  it('as barras ficam dentro da área', () => {
    const bars = barGeometry(Array.from({ length: 30 }, (_, i) => i * 10), 600, 160);
    for (const b of bars) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(600);
      expect(b.y + b.height).toBeLessThanOrEqual(160);
    }
  });
});
