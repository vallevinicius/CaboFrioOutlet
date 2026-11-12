import { escapeHtml } from './order-email';
import type { QuoteInput } from '../utils/wholesale';
import type { QuoteLine } from '../utils/wholesale-pricing';

export interface QuoteExtras {
  lines: QuoteLine[];
  estimatedTotal: number | null;
  discountPercent: number | null;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CATEGORY_LABEL: Record<string, string> = { camisas: 'Camisas', 'calças': 'Calças', bermudas: 'Bermudas', 'bonés': 'Bonés' };

function formatCnpj(d: string): string {
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;
}

/** E-mail enviado à LOJA avisando de um novo pedido de orçamento. Tudo que veio do formulário é escapado. */
export function buildWholesaleQuoteEmail(q: QuoteInput, opts: { storeName: string; adminUrl: string }, extras?: QuoteExtras) {
  const lines = extras?.lines ?? [];
  const interests = q.interests.map((i) => CATEGORY_LABEL[i] ?? i).join(', ') || 'Não informado';
  const rows: [string, string][] = [
    ['Nome', q.name],
    ['Loja/empresa', q.company || '—'],
    ['CNPJ', q.cnpj ? formatCnpj(q.cnpj) : '—'],
    ['WhatsApp', `+${q.phone}`],
    ['E-mail', q.email],
    ['Cidade', `${q.city}/${q.state}`],
    ['Interesse', interests],
    ['Quantidade estimada', q.estimatedPieces ? `${q.estimatedPieces} peças` : '—'],
  ];
  const subject = `Novo pedido de atacado: ${q.name} (${q.city}/${q.state})`;

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:4px">
<tr><td style="background:#0f172a;padding:18px 24px;color:#fff;font-size:17px;font-weight:bold">${escapeHtml(opts.storeName)} · Atacado</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">Novo pedido de orçamento</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows.map(([k, v]) => `<tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:38%">${escapeHtml(k)}</td><td style="padding:6px 0;font-size:14px;color:#0f172a">${escapeHtml(v)}</td></tr>`).join('')}
</table>
${lines.length > 0 ? `<p style="margin:18px 0 6px;font-size:12px;color:#64748b">Peças escolhidas${extras?.discountPercent ? ` (desconto de ${extras.discountPercent}%)` : ''}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines.map((l) => `<tr><td style="padding:4px 0;font-size:13px;color:#0f172a">${escapeHtml(l.name)} · ${escapeHtml(l.size)} × ${l.quantity}</td><td style="padding:4px 0;font-size:13px;color:#0f172a;text-align:right">${brl(l.unitPrice * l.quantity)}</td></tr>`).join('')}<tr><td style="padding:8px 0 0;font-size:14px;font-weight:bold">Total estimado</td><td style="padding:8px 0 0;font-size:14px;font-weight:bold;text-align:right">${brl(extras?.estimatedTotal ?? 0)}</td></tr></table>` : ''}
${q.message ? `<p style="margin:18px 0 4px;font-size:12px;color:#64748b">Mensagem</p><p style="margin:0;font-size:14px;color:#0f172a;white-space:pre-line">${escapeHtml(q.message)}</p>` : ''}
<p style="margin:24px 0 0"><a href="${escapeHtml(opts.adminUrl)}" style="display:inline-block;background:#FFC700;color:#000;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 20px;border-radius:2px">Abrir no painel</a></p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    'Novo pedido de orçamento de atacado',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(lines.length > 0
      ? ['', `Peças escolhidas${extras?.discountPercent ? ` (desconto de ${extras.discountPercent}%)` : ''}:`, ...lines.map((l) => `- ${l.name} (${l.size}) x${l.quantity}: ${brl(l.unitPrice * l.quantity)}`), `Total estimado: ${brl(extras?.estimatedTotal ?? 0)}`]
      : []),
    ...(q.message ? ['', 'Mensagem:', q.message] : []),
    '',
    `Painel: ${opts.adminUrl}`,
  ].join('\n');

  return { subject, html, text };
}
