import { describe, expect, it } from 'vitest';
import { EmailOrder, buildOrderConfirmationEmail, orderCode, paymentLabel } from './order-email';

const order: EmailOrder = {
  id: 'cmu4stwin0000nknffustupxu',
  customerName: 'Maria da Silva',
  total: 219.8,
  shippingCost: 19.9,
  shippingService: 'PAC',
  shippingStreet: 'Rua A',
  shippingNumber: '10',
  shippingComplement: null,
  shippingNeighborhood: 'Centro',
  shippingCity: 'Cabo Frio',
  shippingState: 'RJ',
  shippingCep: '28905000',
  paymentMethod: 'credit_card',
  installments: 3,
  items: [{ productName: 'Camisa Oversized', size: 'M', quantity: 2, unitPrice: 99.95 }],
};
const opts = { storeName: 'Cabo Frio Outlet', baseUrl: 'https://loja.com.br' };

describe('buildOrderConfirmationEmail', () => {
  it('monta assunto, itens, totais, pagamento e link do pedido', () => {
    const { subject, html, text } = buildOrderConfirmationEmail(order, opts);
    expect(subject).toBe(`Pedido #${orderCode(order.id)} confirmado | Cabo Frio Outlet`);
    expect(html).toContain('Oi, Maria!');
    expect(html).toContain('Camisa Oversized');
    expect(html).toContain('Cartão de crédito em 3x');
    expect(html).toContain('https://loja.com.br/minha-conta');
    expect(html).toContain('Rua A, 10');
    expect(text).toContain('Camisa Oversized (tam. M) x2');
    expect(text).toContain('Acompanhe em: https://loja.com.br/minha-conta');
  });
  it('frete grátis aparece como "Grátis"', () => {
    const { html, text } = buildOrderConfirmationEmail({ ...order, shippingCost: 0 }, opts);
    expect(html).toContain('Grátis');
    expect(text).toContain('Frete: Grátis');
  });
  it('escapa HTML em nome do cliente, produto e loja (sem XSS no e-mail)', () => {
    const evil = buildOrderConfirmationEmail(
      {
        ...order,
        customerName: '<img src=x onerror=alert(1)>',
        items: [{ productName: '<script>alert(1)</script>', size: '"M"', quantity: 1, unitPrice: 10 }],
      },
      { ...opts, storeName: '<b>Loja</b>' },
    );
    expect(evil.html).not.toContain('<script>');
    expect(evil.html).not.toContain('<img src=x');
    expect(evil.html).not.toContain('<b>Loja</b>');
    expect(evil.html).toContain('&lt;script&gt;');
  });
  it('sem endereço, omite o bloco de entrega', () => {
    const { html } = buildOrderConfirmationEmail(
      { ...order, shippingStreet: null, shippingNumber: null, shippingNeighborhood: null, shippingCity: null, shippingState: null, shippingCep: null },
      opts,
    );
    expect(html).not.toContain('>Entrega<');
  });
});

describe('helpers', () => {
  it('paymentLabel cobre Pix, débito, crédito à vista e desconhecido', () => {
    expect(paymentLabel('bank_transfer', null)).toBe('Pix');
    expect(paymentLabel('debit_card', null)).toBe('Cartão de débito');
    expect(paymentLabel('credit_card', 1)).toBe('Cartão de crédito');
    expect(paymentLabel(null, null)).toBe('Pagamento aprovado');
  });
  it('orderCode usa os 8 últimos caracteres em maiúsculas', () => {
    expect(orderCode('abcdefghijkl')).toBe('EFGHIJKL');
  });
});
