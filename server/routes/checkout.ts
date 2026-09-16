import { Router } from 'express';
import { prisma } from '../db';
import { optionalAuth } from '../middleware/auth';
import { MP_PUBLIC_KEY, mpFetch } from '../services/mercadopago';
import { restoreStockForOrder } from '../services/stock';

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
  selectedPaymentMethod?: string;
  payment_method_id?: string;
  token?: string;
  issuer_id?: string;
  installments?: number;
  payer?: PayerInput;
}

interface OrderPaymentInfo {
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

// Resposta da Orders API: em sucesso (2xx) o corpo é o pedido diretamente;
// em erro de pagamento (ex: 402 recusado) o pedido vem aninhado em `data`,
// junto com uma lista de erros. As duas formas trazem o pedido completo.
interface MpOrderResponse {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transactions?: { payments?: OrderPaymentInfo[] };
}

interface MpOrderErrorResponse {
  errors?: { code?: string; message?: string; details?: string[] }[];
  data?: MpOrderResponse;
}

// Aplica o resultado de um pagamento (vindo tanto da resposta direta da API
// quanto do webhook) ao pedido correspondente, de forma idempotente.
// Vocabulário de status da Orders API: "processed" (aprovado), "failed" /
// "cancelled" (recusado), "processing" / demais (pendente, aguardando).
async function applyPaymentResult(orderId: string, payment: OrderPaymentInfo) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  const paymentId = payment.id ?? null;
  const status = payment.status ?? 'processing';
  const paymentMethod = payment.payment_method?.type ?? null;
  const installments = payment.payment_method?.installments ?? null;

  if (status === 'processed') {
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: 'pendente' },
      data: { status: 'confirmado', paymentId, paymentMethod, paymentStatus: status, installments },
    });
    if (updated.count === 0) {
      // Já processado antes (ex: webhook chegou depois da resposta direta) — apenas garante os dados de pagamento.
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentId, paymentMethod, paymentStatus: status, installments },
      });
    }
  } else if (status === 'failed' || status === 'cancelled') {
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: 'pendente' },
      data: { status: 'cancelado', paymentId, paymentMethod, paymentStatus: status, installments },
    });
    if (updated.count > 0) {
      await restoreStockForOrder(orderId);
    }
  } else {
    // processing / action_required (ex: Pix aguardando pagamento) — mantém o pedido como pendente.
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentId, paymentMethod, paymentStatus: status, installments },
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

  const amount = order.total.toFixed(2);

  // Cartão precisa de token/installments; Pix e boleto não aceitam esses campos
  // (a Orders API rejeita com "Properties not supported" se forem enviados).
  const isCardPayment = body.selectedPaymentMethod === 'credit_card' || body.selectedPaymentMethod === 'debit_card';

  const result = await mpFetch<MpOrderResponse | MpOrderErrorResponse>('/v1/orders', {
    method: 'POST',
    idempotencyKey: order.id,
    body: {
      type: 'online',
      processing_mode: 'automatic',
      external_reference: order.id,
      total_amount: amount,
      payer: {
        email: body.payer?.email ?? order.customerContact,
        first_name: body.payer?.first_name,
        last_name: body.payer?.last_name,
        identification:
          body.payer?.identification?.type && body.payer?.identification?.number
            ? { type: body.payer.identification.type, number: body.payer.identification.number }
            : undefined,
      },
      transactions: {
        payments: [
          {
            amount,
            payment_method: {
              id: body.payment_method_id,
              type: body.selectedPaymentMethod,
              ...(isCardPayment ? { token: body.token, installments: body.installments ?? 1 } : {}),
            },
          },
        ],
      },
    },
  });

  // Em respostas de erro (ex: pagamento recusado), o pedido vem aninhado em `data`.
  const orderData: MpOrderResponse | undefined = result.ok
    ? (result.body as MpOrderResponse)
    : (result.body as MpOrderErrorResponse).data;

  if (!orderData) {
    const errorMessage =
      (result.body as MpOrderErrorResponse).errors?.[0]?.message ?? 'Erro ao processar o pagamento.';
    return res.status(400).json({ error: errorMessage });
  }

  const payment = orderData.transactions?.payments?.[0];
  const updatedOrder = payment ? await applyPaymentResult(order.id, payment) : null;

  res.json({
    status: payment?.status ?? orderData.status,
    statusDetail: payment?.status_detail ?? orderData.status_detail,
    orderId: order.id,
    orderStatus: updatedOrder?.status ?? order.status,
    paymentId: payment?.id,
    qrCode: payment?.payment_method?.qr_code,
    qrCodeBase64: payment?.payment_method?.qr_code_base64,
    ticketUrl: payment?.payment_method?.ticket_url,
  });
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

// Notificação assíncrona da Mercado Pago (webhook). Precisa de URL pública
// configurada no painel do Mercado Pago para funcionar fora de localhost —
// usada principalmente para confirmar Pix/boleto, já que cartão responde na hora.
checkoutRouter.post('/webhook', async (req, res) => {
  try {
    const body = req.body as { type?: string; action?: string; data?: { id?: string } };
    const mpOrderId = body.data?.id ?? (req.query['data.id'] as string | undefined);
    const type = body.type ?? (req.query['type'] as string | undefined);

    if (type === 'order' && mpOrderId) {
      const result = await mpFetch<MpOrderResponse>(`/v1/orders/${mpOrderId}`);
      const orderId = result.body.external_reference;
      const payment = result.body.transactions?.payments?.[0];
      if (orderId && payment) {
        await applyPaymentResult(orderId, payment);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Erro no webhook do Mercado Pago:', err);
    res.sendStatus(200);
  }
});
