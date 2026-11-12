import { describe, expect, it } from 'vitest';
import { formatCnpj } from './cnpj';

describe('formatCnpj', () => {
  it('aplica a máscara aos poucos', () => {
    expect(formatCnpj('')).toBe('');
    expect(formatCnpj('11')).toBe('11');
    expect(formatCnpj('11222')).toBe('11.222');
    expect(formatCnpj('11222333')).toBe('11.222.333');
    expect(formatCnpj('112223330001')).toBe('11.222.333/0001');
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
  it('ignora letras e corta o excesso', () => {
    expect(formatCnpj('11.222.333/0001-81999')).toBe('11.222.333/0001-81');
    expect(formatCnpj('ab1c2')).toBe('12');
  });
});
