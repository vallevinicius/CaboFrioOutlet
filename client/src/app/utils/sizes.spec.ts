import { describe, expect, it } from 'vitest';
import { checkNewSize, MAX_SIZE_LENGTH } from './sizes';

describe('checkNewSize', () => {
  it('normaliza: tira espaços das pontas e deixa em maiúsculas', () => {
    expect(checkNewSize(['P', 'M'], '  gg ')).toEqual({ ok: true, size: 'GG' });
  });
  it('aceita números e nomes compostos', () => {
    expect(checkNewSize([], '42')).toEqual({ ok: true, size: '42' });
    expect(checkNewSize([], '2 / 3')).toEqual({ ok: true, size: '2 / 3' });
  });
  it('recusa vazio ou só espaços', () => {
    expect(checkNewSize(['P'], '   ')).toMatchObject({ ok: false });
  });
  it('recusa tamanho que o produto já tem (sem diferenciar caixa)', () => {
    expect(checkNewSize(['P', 'GG'], 'gg')).toMatchObject({ ok: false, error: expect.stringContaining('já existe') });
  });
  it('recusa nome acima do limite do servidor', () => {
    expect(checkNewSize([], 'X'.repeat(MAX_SIZE_LENGTH + 1))).toMatchObject({ ok: false });
    expect(checkNewSize([], 'X'.repeat(MAX_SIZE_LENGTH))).toMatchObject({ ok: true });
  });
});
