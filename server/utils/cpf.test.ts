import { describe, expect, it } from 'vitest';
import { isValidCpf, publicCpf, staffCpfPlaceholder } from './cpf.js';

describe('CPF de usuário da equipe', () => {
  it('gera um valor único a cada chamada (a coluna cpf é @unique)', () => {
    const values = new Set(Array.from({ length: 50 }, () => staffCpfPlaceholder()));
    expect(values.size).toBe(50);
  });
  it('nunca é um CPF válido nem vazio (não colide com cliente real nem com o admin do seed)', () => {
    const value = staffCpfPlaceholder();
    expect(value).not.toBe('');
    expect(isValidCpf(value)).toBe(false);
  });
  it('publicCpf esconde o marcador interno e mantém CPFs reais e vazios', () => {
    expect(publicCpf(staffCpfPlaceholder())).toBe('');
    expect(publicCpf('52998224725')).toBe('52998224725');
    expect(publicCpf('')).toBe('');
  });
});
