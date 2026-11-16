import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { appWith } from '../test/helpers.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});
const mpFetch = vi.hoisted(() => vi.fn());
vi.mock('../services/mercadopago', () => ({ MP_PUBLIC_KEY: 'pk-teste', mpFetch }));
const notifyOrderConfirmed = vi.hoisted(() => vi.fn());
vi.mock('../services/order-notifications', () => ({ notifyOrderConfirmed }));
const restoreStockForOrder = vi.hoisted(() => vi.fn());
vi.mock('../services/stock', () => ({ restoreStockForOrder }));

import { checkoutRouter } from './checkout.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/checkout', checkoutRouter);
const flush = () => new Promise((r) => setTimeout(r, 0));

const pendingOrder = { id: 'ord1', status: 'pendente', total: 219.8, customerContact: 'maria@exemplo.com' };
const mpApproved = (status: string) => ({
  ok: true,
  status: 201,
  body: { id: 'mp1', status, transactions: { payments: [{ id: 'pay1', status, payment_method: { type: 'credit_card', installments: 3 } }] } },
});

beforeEach(() => {
  mockReset(prisma());
  mpFetch.mockReset();
  notifyOrderConfirmed.mockReset();
  restoreStockForOrder.mockReset();
});

describe('POST /pay: validação', () => {
  it('exige pedido e método de pagamento', async () => {
    await request(app).post('/api/checkout/pay').send({}).expect(400);
    await request(app).post('/api/checkout/pay').send({ orderId: 'ord1' }).expect(400);
  });
  it('pedido inexistente: 404; já processado: 400 (não cobra duas vezes)', async () => {
    prisma().order.findUnique.mockResolvedValueOnce(null as never);
    await request(app).post('/api/checkout/pay').send({ orderId: 'x', payment_method_id: 'pix' }).expect(404);

    prisma().order.findUnique.mockResolvedValueOnce({ ...pendingOrder, status: 'confirmado' } as never);
    await request(app).post('/api/checkout/pay').send({ orderId: 'ord1', payment_method_id: 'pix' }).expect(400);
    expect(mpFetch).not.toHaveBeenCalled();
  });
});

describe('POST /pay: resultado do pagamento', () => {
  it('a cobrança usa o total do pedido no banco, nunca um valor enviado pelo cliente', async () => {
    prisma().order.findUnique.mockResolvedValue(pendingOrder as never);
    prisma().order.updateMany.mockResolvedValue({ count: 1 } as never);
    mpFetch.mockResolvedValue(mpApproved('processed'));
    await request(app)
      .post('/api/checkout/pay')
      .send({ orderId: 'ord1', payment_method_id: 'visa', selectedPaymentMethod: 'credit_card', token: 't', total: 1 })
      .expect(200);
    expect(mpFetch.mock.calls[0][1].body.total_amount).toBe('219.80');
    expect(mpFetch.mock.calls[0][1].idempotencyKey).toBe('ord1');
  });

  it('aprovado: confirma o pedido e dispara o e-mail uma vez', async () => {
    prisma().order.findUnique.mockResolvedValue(pendingOrder as never);
    prisma().order.updateMany.mockResolvedValue({ count: 1 } as never);
    mpFetch.mockResolvedValue(mpApproved('processed'));
    const res = await request(app)
      .post('/api/checkout/pay')
      .send({ orderId: 'ord1', payment_method_id: 'visa', selectedPaymentMethod: 'credit_card', token: 't' })
      .expect(200);
    await flush();
    expect(prisma().order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ord1', status: 'pendente' }, data: expect.objectContaining({ status: 'confirmado' }) }),
    );
    expect(notifyOrderConfirmed).toHaveBeenCalledTimes(1);
    expect(notifyOrderConfirmed).toHaveBeenCalledWith('ord1');
    expect(res.body.orderId).toBe('ord1');
  });

  it('aprovação repetida (já confirmado) NÃO reenvia o e-mail', async () => {
    prisma().order.findUnique.mockResolvedValue(pendingOrder as never);
    prisma().order.updateMany.mockResolvedValue({ count: 0 } as never); // outra requisição já confirmou
    prisma().order.update.mockResolvedValue({} as never);
    mpFetch.mockResolvedValue(mpApproved('processed'));
    await request(app)
      .post('/api/checkout/pay')
      .send({ orderId: 'ord1', payment_method_id: 'visa', selectedPaymentMethod: 'credit_card', token: 't' })
      .expect(200);
    await flush();
    expect(notifyOrderConfirmed).not.toHaveBeenCalled();
  });

  it('recusado: cancela o pedido e devolve o estoque, sem e-mail', async () => {
    prisma().order.findUnique.mockResolvedValue(pendingOrder as never);
    prisma().order.updateMany.mockResolvedValue({ count: 1 } as never);
    mpFetch.mockResolvedValue(mpApproved('failed'));
    await request(app)
      .post('/api/checkout/pay')
      .send({ orderId: 'ord1', payment_method_id: 'visa', selectedPaymentMethod: 'credit_card', token: 't' })
      .expect(200);
    expect(prisma().order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelado' }) }),
    );
    expect(restoreStockForOrder).toHaveBeenCalledWith('ord1');
    expect(notifyOrderConfirmed).not.toHaveBeenCalled();
  });

  it('Pix aguardando: mantém pendente (sem confirmar nem cancelar)', async () => {
    prisma().order.findUnique.mockResolvedValue(pendingOrder as never);
    prisma().order.update.mockResolvedValue({ ...pendingOrder } as never);
    mpFetch.mockResolvedValue(mpApproved('processing'));
    await request(app)
      .post('/api/checkout/pay')
      .send({ orderId: 'ord1', payment_method_id: 'pix', selectedPaymentMethod: 'bank_transfer' })
      .expect(200);
    expect(prisma().order.updateMany).not.toHaveBeenCalled();
    expect(notifyOrderConfirmed).not.toHaveBeenCalled();
  });

  it('erro da Mercado Pago sem pedido na resposta vira 400 com mensagem', async () => {
    prisma().order.findUnique.mockResolvedValue(pendingOrder as never);
    mpFetch.mockResolvedValue({ ok: false, status: 400, body: { errors: [{ message: 'Cartão inválido' }] } });
    const res = await request(app)
      .post('/api/checkout/pay')
      .send({ orderId: 'ord1', payment_method_id: 'visa', selectedPaymentMethod: 'credit_card', token: 't' })
      .expect(400);
    expect(res.body.error).toBe('Cartão inválido');
  });
});

describe('POST /pay: motivo da recusa', () => {
  const rejected = (detail: string) => ({
    ok: false,
    status: 402,
    body: { data: { id: 'mp1', status: 'failed', transactions: { payments: [{ id: 'pay1', status: 'failed', status_detail: detail, payment_method: { type: 'credit_card', installments: 1 } }] } } },
  });
  const pay = () =>
    request(app)
      .post('/api/checkout/pay')
      .send({ orderId: 'ord1', payment_method_id: 'master', selectedPaymentMethod: 'credit_card', token: 'tok-secreto-123', payer: { email: 'cliente@exemplo.com' } });

  beforeEach(() => {
    prisma().order.findUnique.mockResolvedValue(pendingOrder as never);
    prisma().order.updateMany.mockResolvedValue({ count: 1 } as never);
  });
  afterEach(() => vi.restoreAllMocks()); // os espiões de console não vazam para outros testes

  it('grava o motivo no pedido e devolve ao front', async () => {
    mpFetch.mockResolvedValue(rejected('cc_rejected_other_reason'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await pay().expect(200);
    expect(prisma().order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelado', paymentStatusDetail: 'cc_rejected_other_reason' }) }),
    );
    expect(res.body.statusDetail).toBe('cc_rejected_other_reason');
    expect(res.body.orderStatus).toBeDefined();
  });

  it('registra a recusa no log com pedido, pagamento e motivo, sem token nem e-mail do cliente', async () => {
    mpFetch.mockResolvedValue(rejected('cc_rejected_insufficient_amount'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await pay().expect(200);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('cc_rejected_insufficient_amount');
    expect(logged).toContain('ord1');
    expect(logged).toContain('pay1');
    expect(logged).not.toContain('tok-secreto-123');
    expect(logged).not.toContain('cliente@exemplo.com');
  });

  it('aprovado também guarda o detalhe (accredited) e não polui o log de recusas', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mpFetch.mockResolvedValue({
      ok: true, status: 201,
      body: { id: 'mp1', status: 'processed', transactions: { payments: [{ id: 'pay1', status: 'processed', status_detail: 'accredited', payment_method: { type: 'credit_card', installments: 1 } }] } },
    });
    await pay().expect(200);
    expect(prisma().order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'confirmado', paymentStatusDetail: 'accredited' }) }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('erro da API sem pedido na resposta (400): registra o motivo técnico no log, sem dados do cliente', async () => {
    mpFetch.mockResolvedValue({ ok: false, status: 400, body: { errors: [{ code: '3000', message: 'Cartão inválido' }] } });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await pay().expect(400);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain('Cartão inválido');
    expect(logged).toContain('ord1');
    expect(logged).not.toContain('tok-secreto-123');
    expect(logged).not.toContain('cliente@exemplo.com');
  });
});

describe('webhook e status', () => {
  it('webhook aplica o resultado do pagamento e sempre responde 200', async () => {
    mpFetch.mockResolvedValue({ ok: true, status: 200, body: { external_reference: 'ord1', ...mpApproved('processed').body } });
    prisma().order.findUnique.mockResolvedValue(pendingOrder as never);
    prisma().order.updateMany.mockResolvedValue({ count: 1 } as never);
    await request(app).post('/api/checkout/webhook').send({ type: 'order', data: { id: 'mp1' } }).expect(200);
    await flush();
    expect(notifyOrderConfirmed).toHaveBeenCalledTimes(1);
  });

  it('webhook com erro interno ainda responde 200 (evita reenvio em loop)', async () => {
    mpFetch.mockRejectedValue(new Error('falha'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await request(app).post('/api/checkout/webhook').send({ type: 'order', data: { id: 'mp1' } }).expect(200);
  });

  it('status do pedido: 404 se não existir e só campos públicos se existir', async () => {
    prisma().order.findUnique.mockResolvedValueOnce(null as never);
    await request(app).get('/api/checkout/orders/zzz/status').expect(404);
    prisma().order.findUnique.mockResolvedValueOnce({ id: 'ord1', status: 'pendente', paymentStatus: null, paymentStatusDetail: null, total: 10 } as never);
    const res = await request(app).get('/api/checkout/orders/ord1/status').expect(200);
    // paymentStatusDetail entrou de propósito: o checkout mostra o motivo da recusa quando o resultado chega pelo polling.
    expect(Object.keys(res.body).sort()).toEqual(['id', 'paymentStatus', 'paymentStatusDetail', 'status', 'total']);
  });
});
