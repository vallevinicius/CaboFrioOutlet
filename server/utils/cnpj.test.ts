import { describe, expect, it } from 'vitest';
import { isValidCnpj, normalizeCnpj } from './cnpj';

describe('CNPJ', () => {
  it('aceita CNPJs com dígitos verificadores corretos (com ou sem máscara)', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('45.723.174/0001-10')).toBe(true);
  });
  it('rejeita dígito errado, tamanho errado e sequências repetidas', () => {
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
    expect(isValidCnpj('1122233300018')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
    expect(isValidCnpj('abc')).toBe(false);
  });
  it('normalizeCnpj mantém só dígitos', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });
});
