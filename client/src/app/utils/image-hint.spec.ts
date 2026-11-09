import { describe, expect, it } from 'vitest';
import { bannerImageHint } from './image-hint';

describe('bannerImageHint', () => {
  it('foto vertical grande não gera aviso', () => {
    expect(bannerImageHint(1100, 1500)).toBeNull();
    expect(bannerImageHint(1400, 1400)).toBeNull();
  });
  it('foto pequena avisa sobre a nitidez e mostra as dimensões', () => {
    expect(bannerImageHint(600, 800)).toContain('600×800');
  });
  it('foto horizontal grande avisa sobre o corte', () => {
    expect(bannerImageHint(2400, 1200)).toContain('horizontal');
  });
  it('dimensões inválidas não geram aviso', () => {
    expect(bannerImageHint(0, 0)).toBeNull();
  });
});
