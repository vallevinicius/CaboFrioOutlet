import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENING_HOURS,
  normalizeEmail,
  normalizeOpeningHours,
  normalizePlaceId,
  normalizeWhatsapp,
  parseOpeningHours,
} from './contact';

describe('normalizeWhatsapp', () => {
  it('formata com DDI 55 e só dígitos', () => {
    expect(normalizeWhatsapp('(22) 99999-1234')).toBe('5522999991234');
    expect(normalizeWhatsapp('+55 22 99999-1234')).toBe('5522999991234');
    expect(normalizeWhatsapp('2233334444')).toBe('552233334444');
  });
  it('vazio apaga o número', () => {
    expect(normalizeWhatsapp('   ')).toBe('');
  });
  it('rejeita números curtos, longos ou com letras só', () => {
    expect(normalizeWhatsapp('12345')).toBeNull();
    expect(normalizeWhatsapp('222999912345678')).toBeNull();
    expect(normalizeWhatsapp('abc')).toBe('');
  });
});

describe('normalizeEmail', () => {
  it('aceita e normaliza e-mails válidos', () => {
    expect(normalizeEmail('  Contato@Loja.com.br ')).toBe('contato@loja.com.br');
  });
  it('vazio apaga o e-mail', () => {
    expect(normalizeEmail('')).toBe('');
  });
  it('rejeita formatos inválidos e tentativa de injeção de cabeçalho', () => {
    expect(normalizeEmail('sem-arroba')).toBeNull();
    expect(normalizeEmail('a@b')).toBeNull();
    expect(normalizeEmail('a@b.com\nBcc: x@y.com')).toBeNull();
    expect(normalizeEmail(`${'a'.repeat(250)}@b.com`)).toBeNull();
  });
});

describe('normalizeOpeningHours', () => {
  it('limpa espaços e ignora linhas totalmente vazias', () => {
    expect(
      normalizeOpeningHours([
        { label: ' Segunda a sábado ', hours: ' 09h às 19h ' },
        { label: '', hours: '' },
      ]),
    ).toEqual([{ label: 'Segunda a sábado', hours: '09h às 19h' }]);
  });
  it('aceita lista vazia (loja sem horário exibido)', () => {
    expect(normalizeOpeningHours([])).toEqual([]);
  });
  it('rejeita formato inválido, linha pela metade, textos longos e excesso de linhas', () => {
    expect(normalizeOpeningHours('x')).toBeNull();
    expect(normalizeOpeningHours([null])).toBeNull();
    expect(normalizeOpeningHours([{ label: 'Dom', hours: 5 }])).toBeNull();
    expect(normalizeOpeningHours([{ label: 'Dom', hours: '' }])).toBeNull();
    expect(normalizeOpeningHours([{ label: 'x'.repeat(61), hours: '9h' }])).toBeNull();
    expect(normalizeOpeningHours(Array(8).fill({ label: 'a', hours: 'b' }))).toBeNull();
  });
});

describe('parseOpeningHours', () => {
  it('usa o padrão quando nulo ou corrompido', () => {
    expect(parseOpeningHours(null)).toEqual(DEFAULT_OPENING_HOURS);
    expect(parseOpeningHours('{quebrado')).toEqual(DEFAULT_OPENING_HOURS);
    expect(parseOpeningHours('"texto"')).toEqual(DEFAULT_OPENING_HOURS);
  });
  it('padrão é seg–sáb 09–19 e domingo 09–14', () => {
    expect(DEFAULT_OPENING_HOURS).toEqual([
      { label: 'Segunda a sábado', hours: '09h às 19h' },
      { label: 'Domingo', hours: '09h às 14h' },
    ]);
  });
  it('respeita lista vazia salva pelo admin', () => {
    expect(parseOpeningHours('[]')).toEqual([]);
  });
});

describe('normalizePlaceId', () => {
  it('aceita Place ID válido e vazio', () => {
    expect(normalizePlaceId(' ChIJN1t_tDeuEmsRUsoyG83frY4 ')).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
    expect(normalizePlaceId('')).toBe('');
  });
  it('rejeita caracteres de URL/injeção', () => {
    expect(normalizePlaceId('abc/../../x')).toBeNull();
    expect(normalizePlaceId('ChIJ?key=abc&x=1234')).toBeNull();
    expect(normalizePlaceId('curto')).toBeNull();
  });
});
