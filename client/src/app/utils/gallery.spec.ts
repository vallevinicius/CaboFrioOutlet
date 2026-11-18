import { describe, expect, it } from 'vitest';
import { wrapIndex, zoomOrigin } from './gallery';

describe('wrapIndex (setas da galeria)', () => {
  it('avança e volta dando a volta nas pontas', () => {
    expect(wrapIndex(1, 4)).toBe(1);
    expect(wrapIndex(4, 4)).toBe(0);
    expect(wrapIndex(-1, 4)).toBe(3);
    expect(wrapIndex(-5, 4)).toBe(3);
  });
  it('com uma foto (ou nenhuma) fica sempre em 0', () => {
    expect(wrapIndex(3, 1)).toBe(0);
    expect(wrapIndex(-1, 0)).toBe(0);
  });
});

describe('zoomOrigin (ponto do zoom, em %)', () => {
  const rect = { left: 100, top: 50, width: 400, height: 500 };
  it('converte a posição do dedo/mouse em porcentagem da foto', () => {
    expect(zoomOrigin(300, 300, rect)).toEqual({ x: 50, y: 50 });
    expect(zoomOrigin(100, 50, rect)).toEqual({ x: 0, y: 0 });
  });
  it('fora da foto fica preso na borda (0 a 100)', () => {
    expect(zoomOrigin(0, 900, rect)).toEqual({ x: 0, y: 100 });
    expect(zoomOrigin(9999, -10, rect)).toEqual({ x: 100, y: 0 });
  });
  it('foto sem tamanho (ainda não renderizada) usa o centro', () => {
    expect(zoomOrigin(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 50, y: 50 });
  });
});
