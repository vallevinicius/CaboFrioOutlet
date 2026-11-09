import { describe, expect, it } from 'vitest';
import { formatWhatsappDisplay, whatsappUrl } from './whatsapp';

describe('whatsappUrl', () => {
  it('monta o link com mensagem codificada', () => {
    expect(whatsappUrl('5522999991234', 'Olá, tudo bem?')).toBe(
      'https://wa.me/5522999991234?text=Ol%C3%A1%2C%20tudo%20bem%3F',
    );
  });
  it('funciona sem mensagem', () => {
    expect(whatsappUrl('552233334444')).toBe('https://wa.me/552233334444');
  });
  it('retorna null para vazio ou número inválido (botão não aparece)', () => {
    expect(whatsappUrl('')).toBeNull();
    expect(whatsappUrl('123')).toBeNull();
    expect(whatsappUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('formatWhatsappDisplay', () => {
  it('formata celular e fixo', () => {
    expect(formatWhatsappDisplay('5522999991234')).toBe('(22) 99999-1234');
    expect(formatWhatsappDisplay('552233334444')).toBe('(22) 3333-4444');
  });
  it('devolve o original quando não reconhece', () => {
    expect(formatWhatsappDisplay('123')).toBe('123');
  });
});
