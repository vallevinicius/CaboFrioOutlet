import { prisma } from '../db.js';
import { restoreStockForOrder } from './stock.js';
import { notifyOrderConfirmed } from './order-notifications.js';

export interface OrderPaymentInfo {
  id?: string;
  status?: string;
  status_detail?: string;
  payment_method?: {
    type?: string;
    installments?: number;
    qr_code?: string;
    qr_code_base64?: string;
    ticket_url?: string;
  };
}

// Aplica o resultado de um pagamento (vindo tanto da resposta direta da API
// quanto do webhook) ao pedido correspondente, de forma idempotente.
// Vocabulário de status da Orders API: "processed" (aprovado), "failed" /
// "cancelled" (recusado), "processing" / demais (pendente, aguardando).
export async function applyPaymentResult(orderId: string, payment: OrderPaymentInfo) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  const paymentId = payment.id ?? null;
  const status = payment.status ?? 'processing';
  const paymentMethod = payment.payment_method?.type ?? null;
  const installments = payment.payment_method?.installments ?? null;
  const paymentStatusDetail = payment.status_detail ?? null;

  if (status === 'processed') {
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: 'pendente' },
      data: { status: 'confirmado', paymentId, paymentMethod, paymentStatus: status, paymentStatusDetail, installments },
    });
    if (updated.count > 0) {
      // Só na transição pendente → confirmado: webhook repetido não duplica o e-mail.
      void notifyOrderConfirmed(orderId);
    }
    if (updated.count === 0) {
      // Já processado antes (ex: webhook chegou depois da resposta direta) — apenas garante os dados de pagamento.
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentId, paymentMethod, paymentStatus: status, paymentStatusDetail, installments },
      });
    }
  } else if (status === 'failed' || status === 'cancelled') {
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: 'pendente' },
      data: { status: 'cancelado', paymentId, paymentMethod, paymentStatus: status, paymentStatusDetail, installments },
    });
    if (updated.count > 0) {
      await restoreStockForOrder(orderId);
      // Só IDs e o motivo: nunca token do cartão, e-mail ou documento do cliente.
      console.warn('[pagamento] recusado', JSON.stringify({ orderId, paymentId, status, statusDetail: paymentStatusDetail, method: paymentMethod, installments }));
    }
  } else {
    // processing / action_required (ex: Pix aguardando pagamento) — mantém o pedido como pendente.
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentId, paymentMethod, paymentStatus: status, paymentStatusDetail, installments },
    });
  }

  return prisma.order.findUnique({ where: { id: orderId } });
}
