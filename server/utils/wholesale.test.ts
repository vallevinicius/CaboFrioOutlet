import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WHOLESALE_NOTES,
  isHoneypotFilled,
  normalizeMinPieces,
  normalizeWholesaleNotes,
  validateQuote,
} from './wholesale';

const valid = {
  name: '  Maria  Souza ',
  company: 'Loja da Maria',
  cnpj: '11.222.333/0001-81',
  phone: '(22) 99999-1234',
  email: ' Maria@Loja.com ',
  city: 'Búzios',
  state: 'rj',
  interests: ['camisas', 'bonés', 'camisas'],
  estimatedPieces: '50',
  message: 'Quero ver\ncatálogo',
  consent: true,
};

describe('validateQuote', () => {
  it('aceita e normaliza um pedido completo', () => {
    const r = validateQuote(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      name: 'Maria Souza',
      cnpj: '11222333000181',
      phone: '5522999991234',
      email: 'maria@loja.com',
      state: 'RJ',
      interests: ['camisas', 'bonés'],
      estimatedPieces: 50,
      message: 'Quero ver\ncatálogo',
    });
  });

  it('CNPJ, empresa, categorias, quantidade e mensagem são opcionais', () => {
    const r = validateQuote({ name: 'Ana', phone: '2233334444', email: 'a@b.co', city: 'Cabo Frio', state: 'RJ', consent: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ cnpj: '', company: '', interests: [], estimatedPieces: null, message: '' });
  });

  it.each([
    ['sem nome', { name: ' ' }],
    ['CNPJ inválido', { cnpj: '11.222.333/0001-80' }],
    ['telefone curto', { phone: '123' }],
    ['e-mail inválido', { email: 'sem-arroba' }],
    ['e-mail com injeção de cabeçalho', { email: 'a@b.com\nBcc: x@y.com' }],
    ['sem cidade', { city: '' }],
    ['UF inválida', { state: 'Rio' }],
    ['categoria desconhecida', { interests: ['drogas'] }],
    ['categorias com tipo errado', { interests: 'camisas' }],
    ['quantidade negativa', { estimatedPieces: -3 }],
    ['quantidade quebrada', { estimatedPieces: 2.5 }],
    ['mensagem longa demais', { message: 'x'.repeat(1001) }],
    ['sem consentimento', { consent: false }],
    ['consentimento como texto', { consent: 'true' }],
  ])('rejeita: %s', (_nome, over) => {
    expect(validateQuote({ ...valid, ...over }).ok).toBe(false);
  });

  it('rejeita corpo que não é objeto', () => {
    expect(validateQuote(null).ok).toBe(false);
    expect(validateQuote('texto').ok).toBe(false);
  });
});

describe('isHoneypotFilled', () => {
  it('só é robô se o campo-isca vier preenchido', () => {
    expect(isHoneypotFilled({ website: 'http://spam.com' })).toBe(true);
    expect(isHoneypotFilled({ website: '  ' })).toBe(false);
    expect(isHoneypotFilled({})).toBe(false);
    expect(isHoneypotFilled(null)).toBe(false);
  });
});

describe('configurações do atacado', () => {
  it('pedido mínimo: inteiro de 1 a 10000', () => {
    expect(normalizeMinPieces(10)).toBe(10);
    expect(normalizeMinPieces(10000)).toBe(10000);
    for (const bad of [0, -1, 2.5, 10001, '10', null, NaN]) expect(normalizeMinPieces(bad)).toBeNull();
  });
  it('condições: uma por linha, sem vazias; vazio é válido; longo demais é recusado', () => {
    expect(normalizeWholesaleNotes(' a \r\n\r\n  b  ')).toBe('a\nb');
    expect(normalizeWholesaleNotes('   ')).toBe('');
    expect(normalizeWholesaleNotes('x'.repeat(1501))).toBeNull();
    expect(normalizeWholesaleNotes(5)).toBeNull();
  });
  it('o texto padrão tem três condições', () => {
    expect(DEFAULT_WHOLESALE_NOTES.split('\n')).toHaveLength(3);
  });
});
