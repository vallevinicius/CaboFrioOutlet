import { describe, expect, it } from 'vitest';
import type { QuoteInput } from '../utils/wholesale';
import { buildWholesaleQuoteEmail } from './wholesale-email';

const q: QuoteInput = {
  name: 'Maria',
  company: 'Loja da Maria',
  cnpj: '11222333000181',
  phone: '5522999991234',
  email: 'maria@loja.com',
  city: 'Búzios',
  state: 'RJ',
  interests: ['camisas', 'bonés'],
  estimatedPieces: 50,
  message: 'Quero o catálogo',
};
const opts = { storeName: 'Cabo Frio Outlet', adminUrl: 'https://loja.com.br/admin' };

describe('buildWholesaleQuoteEmail: peças escolhidas', () => {
  const extras = {
    lines: [{ productId: 'a', name: 'Camisa <b>', size: 'M', quantity: 10, unitPrice: 95 }],
    estimatedTotal: 950,
    discountPercent: 5,
  };
  it('lista as peças, o desconto e o total estimado', () => {
    const { html, text } = buildWholesaleQuoteEmail(q, opts, extras);
    expect(html).toContain('desconto de 5%');
    expect(html).toContain('Total estimado');
    expect(text).toContain('Total estimado: R$');
    expect(text).toContain('x10');
  });
  it('escapa o nome do produto', () => {
    const { html } = buildWholesaleQuoteEmail(q, opts, extras);
    expect(html).not.toContain('Camisa <b>');
    expect(html).toContain('Camisa &lt;b&gt;');
  });
  it('sem peças, não há bloco de peças', () => {
    expect(buildWholesaleQuoteEmail(q, opts).html).not.toContain('Peças escolhidas');
  });
});

describe('buildWholesaleQuoteEmail', () => {
  it('monta assunto, dados do cliente, CNPJ formatado e link do painel', () => {
    const { subject, html, text } = buildWholesaleQuoteEmail(q, opts);
    expect(subject).toBe('Novo pedido de atacado: Maria (Búzios/RJ)');
    expect(html).toContain('11.222.333/0001-81');
    expect(html).toContain('Camisas, Bonés');
    expect(html).toContain('50 peças');
    expect(html).toContain('https://loja.com.br/admin');
    expect(text).toContain('WhatsApp: +5522999991234');
  });
  it('escapa HTML vindo do formulário (sem XSS no e-mail da loja)', () => {
    const { html } = buildWholesaleQuoteEmail(
      { ...q, name: '<img src=x onerror=alert(1)>', message: '<script>alert(1)</script>', company: '"><b>x</b>' },
      opts,
    );
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('campos opcionais vazios aparecem como traço e sem bloco de mensagem', () => {
    const { html } = buildWholesaleQuoteEmail({ ...q, company: '', cnpj: '', estimatedPieces: null, message: '', interests: [] }, opts);
    expect(html).toContain('Não informado');
    expect(html).not.toContain('Mensagem</p>');
  });
});
