import { prisma } from '../db.js';
import { mpFetch } from './mercadopago.js';
import { applyPaymentResult } from './payment-result.js';

/**
 * O resultado final de um pagamento pode demorar (cartão "em análise", Pix) e depende do
 * webhook do Mercado Pago, que pode falhar ou nem estar configurado. Aqui o servidor
 * pergunta direto ao Mercado Pago, para o pedido nunca ficar parado esperando um aviso.
 */

const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;
const POLL_COOLDOWN_MS = 15_000;
const BACKGROUND_INTERVAL_MS = 2 * 60 * 1000;
const BATCH_SIZE = 25;

interface ClassicPayment {
  id?: number | string;
  status?: string;
  status_detail?: string;
  payment_type_id?: string;
  installments?: number;
  date_created?: string;
}

/** Status da API de pagamentos → vocabulário da Orders API que o `applyPaymentResult` entende. Só resultados finais. */
export function mapClassicStatus(status: string | undefined): 'processed' | 'failed' | 'cancelled' | null {
  if (status === 'approved') return 'processed';
  if (status === 'rejected') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  return null; // in_process, pending, authorized, refunded... não decidem o pedido
}

/** Devolve true se o pedido saiu de "pendente" (confirmado ou cancelado) por causa desta conferência. */
export async function reconcileOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, paymentId: true } });
  if (!order || order.status !== 'pendente') return false;

  const result = await mpFetch<{ results?: ClassicPayment[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc`,
  );
  const payments = result.ok ? result.body?.results : undefined;
  if (!Array.isArray(payments) || payments.length === 0) return false;

  // Se o cliente tentou mais de uma vez, um pagamento aprovado vale mais que um recusado.
  const payment = payments.find((p) => p.status === 'approved') ?? payments[0];
  const status = mapClassicStatus(payment.status);
  if (!status) return false;

  const updated = await applyPaymentResult(orderId, {
    id: order.paymentId ?? (payment.id !== undefined ? String(payment.id) : undefined),
    status,
    status_detail: payment.status_detail,
    payment_method: { type: payment.payment_type_id, installments: payment.installments },
  });
  return updated !== null && updated.status !== 'pendente';
}

const lastPolled = new Map<string, number>();

/** Para o endpoint que o checkout consulta a cada poucos segundos: no máximo uma ida ao Mercado Pago por pedido a cada 15s. */
export async function reconcileOrderThrottled(orderId: string, now: number = Date.now()): Promise<boolean> {
  for (const [id, at] of lastPolled) if (now - at > 60 * 60 * 1000) lastPolled.delete(id);
  const last = lastPolled.get(orderId);
  if (last !== undefined && now - last < POLL_COOLDOWN_MS) return false;
  lastPolled.set(orderId, now);
  try {
    return await reconcileOrder(orderId);
  } catch (err) {
    console.error('[pagamento] falha ao conferir com o Mercado Pago', JSON.stringify({ orderId, erro: String(err) }));
    return false;
  }
}

/** Confere os pedidos pendentes com pagamento iniciado (cliente que fechou a página, webhook que não chegou). */
export async function reconcilePendingOrders(): Promise<void> {
  const pending = await prisma.order.findMany({
    where: { status: 'pendente', paymentId: { not: null }, createdAt: { gt: new Date(Date.now() - PENDING_WINDOW_MS) } },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
    select: { id: true },
  });
  for (const { id } of pending) {
    try {
      await reconcileOrder(id);
    } catch (err) {
      console.error('[pagamento] falha ao conferir com o Mercado Pago', JSON.stringify({ orderId: id, erro: String(err) }));
    }
  }
}

let running = false;

/** Liga a conferência periódica (a cada 2 minutos, sem rodar duas ao mesmo tempo). */
export function startPaymentReconciler(): void {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await reconcilePendingOrders();
    } catch (err) {
      console.error('[pagamento] conferência periódica falhou', String(err));
    } finally {
      running = false;
    }
  };
  setTimeout(() => void tick(), 30_000).unref();
  setInterval(() => void tick(), BACKGROUND_INTERVAL_MS).unref();
}
