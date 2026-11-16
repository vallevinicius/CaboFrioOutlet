import { describe, expect, it } from 'vitest';
import { publicCpf } from './cpf.js';

describe('publicCpf (marcador antigo de conta da equipe)', () => {
  it('esconde o marcador interno e mantém CPFs reais e vazios', () => {
    expect(publicCpf('equipe-123e4567-e89b-12d3-a456-426614174000')).toBe('');
    expect(publicCpf('52998224725')).toBe('52998224725');
    expect(publicCpf('')).toBe('');
  });
});
