import { describe, expect, it } from 'vitest';
import { normalizeGaId, normalizeMetaPixelId } from './analytics';

describe('normalizeGaId', () => {
  it('aceita G-XXXX (em qualquer caixa) e vazio', () => {
    expect(normalizeGaId(' g-ab12cd34ef ')).toBe('G-AB12CD34EF');
    expect(normalizeGaId('')).toBe('');
  });
  it('rejeita formatos errados e tentativas de injetar código', () => {
    expect(normalizeGaId('UA-12345-1')).toBeNull();
    expect(normalizeGaId('G-')).toBeNull();
    expect(normalizeGaId("G-ABCD');alert(1);//")).toBeNull();
    expect(normalizeGaId('G-ABCD"></script>')).toBeNull();
    expect(normalizeGaId(123)).toBeNull();
  });
});

describe('normalizeMetaPixelId', () => {
  it('aceita só dígitos e vazio', () => {
    expect(normalizeMetaPixelId(' 1234567890123456 ')).toBe('1234567890123456');
    expect(normalizeMetaPixelId('')).toBe('');
  });
  it('rejeita letras, curtos, longos e código injetado', () => {
    expect(normalizeMetaPixelId('abc')).toBeNull();
    expect(normalizeMetaPixelId('1234567')).toBeNull();
    expect(normalizeMetaPixelId('1'.repeat(21))).toBeNull();
    expect(normalizeMetaPixelId("123');fetch('x')")).toBeNull();
    expect(normalizeMetaPixelId(null)).toBeNull();
  });
});
