import { Router } from 'express';
import { prisma } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { MP_PUBLIC_KEY, mpFetch } from '../services/mercadopago.js';
import { applyPaymentResult, type OrderPaymentInfo } from '../services/payment-result.js';
import { reconcileOrderThrottled } from '../services/payment-reconcile.js';
import { verifyWebhookSignature } from '../services/webhook-signature.js';

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
    const apiErrors = (result.body as MpOrderErrorResponse).errors;
    const errorMessage = apiErrors?.[0]?.message ?? 'Erro ao processar o pagamento.';
    console.error('[pagamento] erro da API do Mercado Pago', JSON.stringify({ orderId: order.id, httpStatus: result.status, errors: apiErrors?.map((e) => ({ code: e.code, message: e.message })) }));
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

const ORDER_STATUS_SELECT = {
  id: true,
  status: true,
  paymentStatus: true,
  paymentStatusDetail: true,
  paymentId: true,
  total: true,
} as const;

// Público e consultado pelo checkout a cada poucos segundos. Se o pedido ainda está pendente
// com um pagamento iniciado, confere o resultado direto no Mercado Pago (no máximo uma vez a cada
// 15s por pedido), para não depender só do webhook.
checkoutRouter.get('/orders/:id/status', async (req, res) => {
  const id = req.params.id as string;
  let order = await prisma.order.findUnique({ where: { id }, select: ORDER_STATUS_SELECT });
  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }

  if (order.status === 'pendente' && order.paymentId) {
    try {
      if (await reconcileOrderThrottled(id)) {
        order = (await prisma.order.findUnique({ where: { id }, select: ORDER_STATUS_SELECT })) ?? order;
      }
    } catch (err) {
      console.error('[pagamento] falha ao conferir com o Mercado Pago', JSON.stringify({ orderId: id, erro: String(err) }));
    }
  }

  // Resposta pública: só o necessário (o id do pagamento fica no servidor).
  res.json({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentStatusDetail: order.paymentStatusDetail,
    total: order.total,
  });
});

let warnedMissingWebhookSecret = false;

// Notificação assíncrona da Mercado Pago (webhook). Precisa de URL pública
// configurada no painel do Mercado Pago (modo produção, evento "Order") para funcionar fora de
// localhost. Se a chave secreta do webhook estiver configurada no servidor, só aceita
// notificações com assinatura válida; sem a chave, aceita como antes (o pedido é sempre
// reconsultado no Mercado Pago, então uma notificação falsa não consegue aprovar nada).
checkoutRouter.post('/webhook', async (req, res) => {
  const secret = process.env.MP_WEBHOOK_SECRET;
  const body = (req.body ?? {}) as { type?: string; action?: string; data?: { id?: string } };

  if (secret) {
    const valid = verifyWebhookSignature({
      secret,
      signature: req.get('x-signature'),
      requestId: req.get('x-request-id'),
      dataId: (req.query['data.id'] as string | undefined) ?? body.data?.id,
    });
    if (!valid) {
      console.warn('[pagamento] webhook recusado: assinatura inválida ou ausente');
      return res.sendStatus(401);
    }
  } else if (!warnedMissingWebhookSecret) {
    warnedMissingWebhookSecret = true;
    console.warn('[pagamento] a chave secreta do webhook não está configurada: notificações sem assinatura estão sendo aceitas');
  }

  try {
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
