import { describe, expect, it } from 'vitest';
import { openCpf, sealCpf } from './cpf-vault.js';

describe('sealCpf / openCpf', () => {
  it('sela o CPF: texto cifrado + carimbo para unicidade; abrir devolve só os números', () => {
    const sealed = sealCpf('529.982.247-25');
    expect(sealed.cpf.startsWith('enc:v1:')).toBe(true);
    expect(sealed.cpf).not.toContain('52998224725');
    expect(sealed.cpfHash).toMatch(/^[0-9a-f]{64}$/);
    expect(openCpf(sealed.cpf)).toBe('52998224725');
  });

  it('o mesmo CPF sempre gera o mesmo carimbo (para barrar conta duplicada), mas texto cifrado diferente', () => {
    const a = sealCpf('52998224725');
    const b = sealCpf('529.982.247-25');
    expect(a.cpfHash).toBe(b.cpfHash);
    expect(a.cpf).not.toBe(b.cpf);
    expect(sealCpf('39053344705').cpfHash).not.toBe(a.cpfHash);
  });

  it('abre CPF antigo ainda em texto puro (migração sem parar o site)', () => {
    expect(openCpf('52998224725')).toBe('52998224725');
  });

  it('vazio, nulo e o marcador antigo de conta da equipe viram texto vazio', () => {
    expect(openCpf('')).toBe('');
    expect(openCpf(null)).toBe('');
    expect(openCpf(undefined)).toBe('');
    expect(openCpf('equipe-123e4567-e89b-12d3-a456-426614174000')).toBe('');
  });
});
