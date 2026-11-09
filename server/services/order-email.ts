export interface EmailOrderItem {
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

export interface EmailOrder {
  id: string;
  customerName: string;
  total: number;
  shippingCost: number;
  shippingService: string | null;
  shippingStreet: string | null;
  shippingNumber: string | null;
  shippingComplement: string | null;
  shippingNeighborhood: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingCep: string | null;
  paymentMethod: string | null;
  installments: number | null;
  items: EmailOrderItem[];
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Código curto exibido ao cliente (os 8 últimos caracteres do ID). */
export function orderCode(id: string): string {
  return id.slice(-8).toUpperCase();
}

export function paymentLabel(method: string | null, installments: number | null): string {
  switch (method) {
    case 'credit_card':
      return installments && installments > 1 ? `Cartão de crédito em ${installments}x` : 'Cartão de crédito';
    case 'debit_card':
      return 'Cartão de débito';
    case 'bank_transfer':
      return 'Pix';
    default:
      return 'Pagamento aprovado';
  }
}

function addressLine(o: EmailOrder): string {
  const parts = [
    [o.shippingStreet, o.shippingNumber].filter(Boolean).join(', '),
    o.shippingComplement,
    o.shippingNeighborhood,
    [o.shippingCity, o.shippingState].filter(Boolean).join(' - '),
    o.shippingCep ? `CEP ${o.shippingCep}` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

export function buildOrderConfirmationEmail(
  order: EmailOrder,
  opts: { storeName: string; baseUrl: string },
): { subject: string; html: string; text: string } {
  const code = orderCode(order.id);
  const subtotal = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const firstName = order.customerName.trim().split(/\s+/)[0] || 'cliente';
  const address = addressLine(order);
  const payment = paymentLabel(order.paymentMethod, order.installments);
  const subject = `Pedido #${code} confirmado | ${opts.storeName}`;
  const accountUrl = `${opts.baseUrl}/minha-conta`;

  const rows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a">${escapeHtml(i.productName)}<br><span style="color:#64748b;font-size:12px">Tamanho ${escapeHtml(i.size)} · Qtd ${i.quantity}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;text-align:right;white-space:nowrap">${brl(i.unitPrice * i.quantity)}</td>
      </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px">
      <tr><td style="background:#0f172a;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:bold">${escapeHtml(opts.storeName)}</td></tr>
      <tr><td style="padding:24px">
        <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Pedido #${code}</p>
        <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a">Pagamento confirmado!</h1>
        <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.5">Oi, ${escapeHtml(firstName)}! Recebemos o seu pagamento e já estamos separando as suas peças.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
          <tr><td style="padding:3px 0;font-size:14px;color:#64748b">Subtotal</td><td style="padding:3px 0;font-size:14px;color:#0f172a;text-align:right">${brl(subtotal)}</td></tr>
          <tr><td style="padding:3px 0;font-size:14px;color:#64748b">Frete${order.shippingService ? ` (${escapeHtml(order.shippingService)})` : ''}</td><td style="padding:3px 0;font-size:14px;color:#0f172a;text-align:right">${order.shippingCost > 0 ? brl(order.shippingCost) : 'Grátis'}</td></tr>
          <tr><td style="padding:8px 0 0;font-size:16px;font-weight:bold;color:#0f172a">Total</td><td style="padding:8px 0 0;font-size:16px;font-weight:bold;color:#0f172a;text-align:right">${brl(order.total)}</td></tr>
        </table>
        <p style="margin:20px 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Pagamento</p>
        <p style="margin:0;font-size:14px;color:#0f172a">${escapeHtml(payment)}</p>
        ${address ? `<p style="margin:16px 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Entrega</p><p style="margin:0;font-size:14px;color:#0f172a;line-height:1.5">${escapeHtml(address)}</p>` : ''}
        <p style="margin:24px 0 0"><a href="${escapeHtml(accountUrl)}" style="display:inline-block;background:#FFC700;color:#000000;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 20px;border-radius:2px;text-transform:uppercase">Acompanhar pedido</a></p>
      </td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#94a3b8">Você recebeu este e-mail porque fez uma compra em ${escapeHtml(opts.storeName)}.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const text = [
    `Pedido #${code} confirmado — ${opts.storeName}`,
    '',
    `Oi, ${firstName}! Recebemos o seu pagamento e já estamos separando as suas peças.`,
    '',
    ...order.items.map((i) => `- ${i.productName} (tam. ${i.size}) x${i.quantity}: ${brl(i.unitPrice * i.quantity)}`),
    '',
    `Subtotal: ${brl(subtotal)}`,
    `Frete: ${order.shippingCost > 0 ? brl(order.shippingCost) : 'Grátis'}`,
    `Total: ${brl(order.total)}`,
    `Pagamento: ${payment}`,
    ...(address ? [`Entrega: ${address}`] : []),
    '',
    `Acompanhe em: ${accountUrl}`,
  ].join('\n');

  return { subject, html, text };
}
