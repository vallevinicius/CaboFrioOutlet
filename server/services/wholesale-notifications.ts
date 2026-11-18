import { prisma } from '../db.js';
import { sendEmail } from './email.js';
import { buildWholesaleQuoteEmail } from './wholesale-email.js';
import type { QuoteInput } from '../utils/wholesale.js';
import type { QuoteLine } from '../utils/wholesale-pricing.js';
import type { QuoteExtras } from './wholesale-email.js';

/** Avisa a loja por e-mail. Nunca lança: o pedido já está salvo e aparece no painel. */
export async function notifyWholesaleQuote(quote: QuoteInput, extras?: { lines: QuoteLine[]; estimatedTotal: number | null; discountPercent: number | null }): Promise<void> {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { storeName: true, contactEmail: true } });
    if (!settings?.contactEmail) return; // sem e-mail da loja no admin: só o painel
    const categories = await prisma.category.findMany({ select: { key: true, name: true } });
    const categoryLabels = Object.fromEntries(categories.map((c) => [c.key, c.name]));
    const baseUrl = (process.env.SITE_URL ?? '').trim().replace(/\/+$/, '') || 'http://localhost:3003';
    const email = buildWholesaleQuoteEmail(quote, { storeName: settings.storeName, adminUrl: `${baseUrl}/admin`, categoryLabels }, extras as QuoteExtras | undefined);
    const result = await sendEmail({ to: settings.contactEmail, ...email });
    if (!result.sent) console.warn(`Aviso de atacado não enviado: ${result.reason}`);
  } catch (err) {
    console.error('Erro ao avisar sobre pedido de atacado:', err instanceof Error ? err.message : err);
  }
}
