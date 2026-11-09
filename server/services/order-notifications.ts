import { prisma } from '../db';
import { sendEmail } from './email';
import { buildOrderConfirmationEmail } from './order-email';

/**
 * Dispara o e-mail de confirmação. Deve ser chamado só na transição
 * pendente → confirmado (garante um único e-mail por pedido). Nunca lança.
 */
export async function notifyOrderConfirmed(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return;
    const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { storeName: true } });
    const baseUrl = (process.env.SITE_URL ?? '').trim().replace(/\/+$/, '') || 'http://localhost:3003';

    const email = buildOrderConfirmationEmail(order, {
      storeName: settings?.storeName ?? 'Cabo Frio Outlet',
      baseUrl,
    });
    const result = await sendEmail({
      to: order.customerContact,
      ...email,
      idempotencyKey: `order-confirmation/${order.id}`,
    });
    if (!result.sent) console.warn(`E-mail do pedido ${order.id} não enviado: ${result.reason}`);
  } catch (err) {
    console.error('Erro ao notificar pedido confirmado:', err instanceof Error ? err.message : err);
  }
}
