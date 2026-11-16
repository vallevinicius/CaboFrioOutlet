import { describe, expect, it } from 'vitest';
import { formatWhatsappDisplay, orderWhatsappUrl, toWhatsappNumber, whatsappUrl } from './whatsapp';

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

describe('toWhatsappNumber', () => {
  it('acrescenta o 55 em número brasileiro de 10 ou 11 dígitos, com ou sem máscara', () => {
    expect(toWhatsappNumber('22999991234')).toBe('5522999991234');
    expect(toWhatsappNumber('(22) 99999-1234')).toBe('5522999991234');
    expect(toWhatsappNumber('(22) 3333-4444')).toBe('552233334444');
  });
  it('mantém número que já vem com 55', () => {
    expect(toWhatsappNumber('5522999991234')).toBe('5522999991234');
    expect(toWhatsappNumber('+55 22 99999-1234')).toBe('5522999991234');
  });
  it('vazio, nulo ou fora do padrão devolve null (sem botão)', () => {
    expect(toWhatsappNumber('')).toBeNull();
    expect(toWhatsappNumber(null)).toBeNull();
    expect(toWhatsappNumber(undefined)).toBeNull();
    expect(toWhatsappNumber('123')).toBeNull();
    expect(toWhatsappNumber('99999999999999999')).toBeNull();
  });
});

describe('orderWhatsappUrl', () => {
  it('abre a conversa com o cliente, citando o primeiro nome, a loja e o número do pedido', () => {
    const url = orderWhatsappUrl('(22) 99999-1234', 'Maria Souza Lima', 'N9PJ6N', 'Cabo Frio Outlet')!;
    expect(url.startsWith('https://wa.me/5522999991234?text=')).toBe(true);
    const text = decodeURIComponent(url.split('?text=')[1]);
    expect(text).toContain('Maria');
    expect(text).not.toContain('Souza');
    expect(text).toContain('Cabo Frio Outlet');
    expect(text).toContain('#N9PJ6N');
  });
  it('sem telefone válido não gera link', () => {
    expect(orderWhatsappUrl('', 'Maria', 'ABC123', 'Loja')).toBeNull();
    expect(orderWhatsappUrl(null, 'Maria', 'ABC123', 'Loja')).toBeNull();
  });
  it('nome vazio não quebra a mensagem', () => {
    const url = orderWhatsappUrl('22999991234', '  ', 'ABC123', 'Loja')!;
    expect(decodeURIComponent(url.split('?text=')[1])).toMatch(/^Olá!/);
  });
});
