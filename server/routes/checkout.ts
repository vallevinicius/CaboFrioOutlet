import { Router } from 'express';
import { prisma } from '../db';
import { optionalAuth } from '../middleware/auth';
import { MP_PUBLIC_KEY, mpPayment } from '../services/mercadopago';

export const checkoutRouter = Router();

checkoutRouter.get('/config', (_req, res) => {
  res.json({ publicKey: MP_PUBLIC_KEY });
});

interface PayerInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  identification?: { type?: string; number?: string };
}

interface PayPayload {
  orderId?: string;
  token?: string;
  payment_method_id?: string;
  issuer_id?: string;
  installments?: number;
  payer?: PayerInput;
}

// Restaura o estoque reservado na criação do pedido quando o pagamento é
// recusado/cancelado. Usa updateMany condicionado ao status atual do pedido
// para não rodar duas vezes (ex: resposta direta do pagamento + webhook).
async function restoreStockForOrder(orderId: string) {
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (!item.productId) continue;
    await prisma.productSize.updateMany({
      where: { productId: item.productId, size: item.size },
      data: { stock: { increment: item.quantity } },
    });
  }
}

function extractPixData(payment: Record<string, unknown>) {
  const poi = payment['point_of_interaction'] as
    | { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } }
    | undefined;
  const data = poi?.transaction_data;
  return {
    qrCode: data?.qr_code,
    qrCodeBase64: data?.qr_code_base64,
    ticketUrl: data?.ticket_url,
  };
}

// Aplica o resultado de um pagamento (vindo tanto da resposta direta da API
// quanto do webhook) ao pedido correspondente, de forma idempotente.
async function applyPaymentResult(orderId: string, payment: {
  id?: number | string;
  status?: string;
  status_detail?: string;
  payment_method_id?: string;
}) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  const paymentId = payment.id != null ? String(payment.id) : null;
  const status = payment.status ?? 'pending';

  if (status === 'approved') {
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: 'pendente' },
      data: {
        status: 'confirmado',
        paymentId,
        paymentMethod: payment.payment_method_id ?? null,
        paymentStatus: status,
      },
    });
    if (updated.count === 0) {
      // Já processado antes (ex: webhook chegou depois da resposta direta) — apenas garante os dados de pagamento.
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentId, paymentMethod: payment.payment_method_id ?? null, paymentStatus: status },
      });
    }
  } else if (status === 'rejected' || status === 'cancelled') {
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: 'pendente' },
      data: {
        status: 'cancelado',
        paymentId,
        paymentMethod: payment.payment_method_id ?? null,
        paymentStatus: status,
      },
    });
    if (updated.count > 0) {
      await restoreStockForOrder(orderId);
    }
  } else {
    // in_process / pending (ex: Pix aguardando pagamento) — mantém o pedido como pendente.
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentId, paymentMethod: payment.payment_method_id ?? null, paymentStatus: status },
    });
  }

  return prisma.order.findUnique({ where: { id: orderId } });
}

checkoutRouter.post('/pay', optionalAuth, async (req, res) => {
  const body = req.body as PayPayload;
  const orderId = body.orderId;

  if (!orderId) {
    return res.status(400).json({ error: 'Pedido não informado.' });
  }
  if (!body.payment_method_id) {
    return res.status(400).json({ error: 'Método de pagamento não informado.' });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }
  if (order.status !== 'pendente') {
    return res.status(400).json({ error: 'Este pedido já foi processado.' });
  }

  try {
    const response = await mpPayment.create({
      body: {
        transaction_amount: order.total,
        description: `Pedido Cabo Frio Outlet #${order.id.slice(-8).toUpperCase()}`,
        payment_method_id: body.payment_method_id,
        token: body.token,
        issuer_id: body.issuer_id ? Number(body.issuer_id) : undefined,
        installments: body.installments ?? 1,
        payer: {
          email: body.payer?.email ?? order.customerContact,
          first_name: body.payer?.first_name,
          last_name: body.payer?.last_name,
          identification: body.payer?.identification,
        },
        external_reference: order.id,
      },
      requestOptions: { idempotencyKey: order.id },
    });

    const updatedOrder = await applyPaymentResult(order.id, response);
    const pix = extractPixData(response as unknown as Record<string, unknown>);

    res.json({
      status: response.status,
      statusDetail: response.status_detail,
      orderId: order.id,
      orderStatus: updatedOrder?.status ?? order.status,
      paymentId: response.id,
      ...pix,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar o pagamento.';
    res.status(400).json({ error: message });
  }
});

checkoutRouter.get('/orders/:id/status', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id as string },
    select: { id: true, status: true, paymentStatus: true, total: true },
  });
  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }
  res.json(order);
});

// Notificação assíncrona da Mercado Pago (webhook/IPN). Precisa de URL pública
// configurada no painel do Mercado Pago para funcionar fora de localhost —
// usada principalmente para confirmar Pix/boleto, já que cartão responde na hora.
checkoutRouter.post('/webhook', async (req, res) => {
  try {
    const body = req.body as { type?: string; action?: string; data?: { id?: string } };
    const paymentId = body.data?.id ?? (req.query['data.id'] as string | undefined);
    const type = body.type ?? (req.query['type'] as string | undefined);

    if (type === 'payment' && paymentId) {
      const payment = await mpPayment.get({ id: paymentId });
      const orderId = payment.external_reference;
      if (orderId) {
        await applyPaymentResult(orderId, payment);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Erro no webhook do Mercado Pago:', err);
    res.sendStatus(200);
  }
});
