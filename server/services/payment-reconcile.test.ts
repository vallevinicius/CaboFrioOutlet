import { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});
const mpFetch = vi.hoisted(() => vi.fn());
vi.mock('./mercadopago', () => ({ MP_PUBLIC_KEY: 'pk', mpFetch }));
const applyPaymentResult = vi.hoisted(() => vi.fn());
vi.mock('./payment-result', () => ({ applyPaymentResult }));

import { mapClassicStatus, reconcileOrder, reconcileOrderThrottled, reconcilePendingOrders } from './payment-reconcile.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const pending = { id: 'ord1', status: 'pendente', paymentId: 'PAY1' };
const search = (...results: object[]) => ({ ok: true, status: 200, body: { results } });
const pay = (status: string, extra: object = {}) => ({ id: 111, status, status_detail: 'det', payment_type_id: 'credit_card', installments: 1, date_created: '2026-11-16T10:00:00', ...extra });

beforeEach(() => {
  mockReset(prisma());
  mpFetch.mockReset();
  applyPaymentResult.mockReset();
  applyPaymentResult.mockResolvedValue({ status: 'cancelado' });
  prisma().order.findUnique.mockResolvedValue(pending as never);
});
afterEach(() => vi.restoreAllMocks());

describe('mapClassicStatus', () => {
  it.each([
    ['approved', 'processed'],
    ['rejected', 'failed'],
    ['cancelled', 'cancelled'],
    ['in_process', null],
    ['pending', null],
    ['authorized', null],
    ['refunded', null],
    ['charged_back', null],
    ['qualquer_coisa_nova', null],
  ])('%s → %s', (status, expected) => {
    expect(mapClassicStatus(status)).toBe(expected);
  });
});

describe('reconcileOrder', () => {
  it('pagamento recusado no Mercado Pago: aplica o resultado "failed" com o motivo', async () => {
    mpFetch.mockResolvedValue(search(pay('rejected', { status_detail: 'cc_rejected_other_reason' })));
    expect(await reconcileOrder('ord1')).toBe(true);
    expect(mpFetch.mock.calls[0][0]).toContain('external_reference=ord1');
    expect(applyPaymentResult).toHaveBeenCalledWith('ord1', expect.objectContaining({
      id: 'PAY1', // mantém o id do pagamento que o pedido já tinha
      status: 'failed',
      status_detail: 'cc_rejected_other_reason',
      payment_method: expect.objectContaining({ type: 'credit_card', installments: 1 }),
    }));
  });

  it('aprovado vence um pagamento recusado anterior (cliente tentou de novo)', async () => {
    mpFetch.mockResolvedValue(search(pay('rejected', { id: 2 }), pay('approved', { id: 1, status_detail: 'accredited' })));
    applyPaymentResult.mockResolvedValue({ status: 'confirmado' });
    expect(await reconcileOrder('ord1')).toBe(true);
    expect(applyPaymentResult).toHaveBeenCalledWith('ord1', expect.objectContaining({ status: 'processed', status_detail: 'accredited' }));
  });

  it('ainda em análise (in_process): não mexe no pedido', async () => {
    mpFetch.mockResolvedValue(search(pay('in_process')));
    expect(await reconcileOrder('ord1')).toBe(false);
    expect(applyPaymentResult).not.toHaveBeenCalled();
  });

  it('nenhum pagamento encontrado, erro da API ou resposta estranha: false e sem lançar', async () => {
    mpFetch.mockResolvedValueOnce(search());
    expect(await reconcileOrder('ord1')).toBe(false);
    mpFetch.mockResolvedValueOnce({ ok: false, status: 500, body: { message: 'x' } });
    expect(await reconcileOrder('ord1')).toBe(false);
    mpFetch.mockResolvedValueOnce({ ok: true, status: 200, body: {} });
    expect(await reconcileOrder('ord1')).toBe(false);
    expect(applyPaymentResult).not.toHaveBeenCalled();
  });

  it('pedido que não está mais pendente (ou não existe): nem consulta o Mercado Pago', async () => {
    prisma().order.findUnique.mockResolvedValueOnce({ ...pending, status: 'confirmado' } as never);
    expect(await reconcileOrder('ord1')).toBe(false);
    prisma().order.findUnique.mockResolvedValueOnce(null as never);
    expect(await reconcileOrder('zzz')).toBe(false);
    expect(mpFetch).not.toHaveBeenCalled();
  });

  it('o id do pedido vai codificado na URL (sem injetar parâmetros)', async () => {
    mpFetch.mockResolvedValue(search());
    await reconcileOrder('a&b=c');
    expect(mpFetch.mock.calls[0][0]).toContain('external_reference=a%26b%3Dc');
  });
});

describe('reconcileOrderThrottled', () => {
  it('no máximo uma consulta ao Mercado Pago a cada 15 segundos por pedido', async () => {
    mpFetch.mockResolvedValue(search(pay('in_process')));
    await reconcileOrderThrottled('thr1', 1_000_000);
    await reconcileOrderThrottled('thr1', 1_000_000 + 14_999);
    expect(mpFetch).toHaveBeenCalledTimes(1);
    await reconcileOrderThrottled('thr1', 1_000_000 + 15_000);
    expect(mpFetch).toHaveBeenCalledTimes(2);
    await reconcileOrderThrottled('outro', 1_000_000 + 15_001); // outro pedido não é afetado
    expect(mpFetch).toHaveBeenCalledTimes(3);
  });
});

describe('reconcilePendingOrders', () => {
  it('confere só pedidos pendentes com pagamento iniciado nas últimas 24h', async () => {
    prisma().order.findMany.mockResolvedValue([] as never);
    await reconcilePendingOrders();
    const where = prisma().order.findMany.mock.calls[0][0]!.where as { status: string; paymentId: unknown; createdAt: { gt: Date } };
    expect(where.status).toBe('pendente');
    expect(where.paymentId).toEqual({ not: null });
    expect(Date.now() - where.createdAt.gt.getTime()).toBeGreaterThan(23.9 * 3600_000);
    expect(Date.now() - where.createdAt.gt.getTime()).toBeLessThan(24.1 * 3600_000);
  });

  it('um pedido com erro não impede os outros', async () => {
    prisma().order.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }] as never);
    prisma().order.findUnique.mockResolvedValue(pending as never);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mpFetch.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(search(pay('rejected')));
    await reconcilePendingOrders();
    expect(applyPaymentResult).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
  });
});
