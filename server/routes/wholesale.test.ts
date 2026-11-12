import request from 'supertest';
import { Prisma, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { appWith, tokenFor } from '../test/helpers';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});
const notify = vi.hoisted(() => vi.fn());
vi.mock('../services/wholesale-notifications', () => ({ notifyWholesaleQuote: notify }));

import { wholesaleRouter } from './wholesale';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/wholesale', wholesaleRouter);
const admin = { Authorization: tokenFor('admin', true) };

const valid = {
  name: 'Maria',
  phone: '(22) 99999-1234',
  email: 'maria@loja.com',
  city: 'Búzios',
  state: 'RJ',
  interests: ['camisas'],
  consent: true,
};
const stored = {
  id: 'q1', createdAt: new Date('2026-11-12T10:00:00Z'), name: 'Maria', company: '', cnpj: '', phone: '5522999991234',
  email: 'maria@loja.com', city: 'Búzios', state: 'RJ', interests: 'camisas,bonés', estimatedPieces: null, message: null, handled: false,
  items: null, estimatedTotal: null, discountPercent: null,
};

beforeEach(() => {
  mockReset(prisma());
  notify.mockReset();
});

describe('POST /api/wholesale/quotes (público)', () => {
  it('grava o pedido com dados normalizados e avisa a loja', async () => {
    prisma().wholesaleQuote.create.mockResolvedValue({} as never);
    await request(app).post('/api/wholesale/quotes').send(valid).expect(201);
    expect(prisma().wholesaleQuote.create.mock.calls[0][0].data).toMatchObject({
      phone: '5522999991234',
      interests: 'camisas',
    });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('dado inválido responde 400 com a mensagem e não grava nem avisa', async () => {
    const res = await request(app).post('/api/wholesale/quotes').send({ ...valid, email: 'ruim' }).expect(400);
    expect(res.body.error).toContain('e-mail');
    await request(app).post('/api/wholesale/quotes').send({ ...valid, consent: false }).expect(400);
    expect(prisma().wholesaleQuote.create).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('robô (campo-isca preenchido) recebe sucesso falso: nada é gravado nem enviado', async () => {
    await request(app).post('/api/wholesale/quotes').send({ ...valid, website: 'http://spam.com' }).expect(201);
    expect(prisma().wholesaleQuote.create).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('não aceita definir "handled" nem "id" pelo formulário', async () => {
    prisma().wholesaleQuote.create.mockResolvedValue({} as never);
    await request(app).post('/api/wholesale/quotes').send({ ...valid, handled: true, id: 'forjado', createdAt: '2000-01-01' }).expect(201);
    const data = prisma().wholesaleQuote.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data['handled']).toBeUndefined();
    expect(data['id']).toBeUndefined();
    expect(data['createdAt']).toBeUndefined();
  });
});

describe('POST /api/wholesale/quotes: peças escolhidas no site', () => {
  const catalog = [
    { id: 'a', name: 'Camisa', price: 100, discountPercent: null, sizes: [{ size: 'M' }, { size: 'P' }] },
    { id: 'b', name: 'Boné', price: 50, discountPercent: 20, sizes: [{ size: 'U' }] },
  ];
  const withItems = (items: unknown, over: object = {}) => ({ ...valid, items, ...over });

  it('o servidor precifica pelo catálogo e pelas faixas; preço enviado pelo cliente é ignorado', async () => {
    prisma().product.findMany.mockResolvedValue(catalog as never);
    prisma().settings.findUnique.mockResolvedValue({ wholesaleTiers: null } as never);
    prisma().wholesaleQuote.create.mockResolvedValue({} as never);
    await request(app)
      .post('/api/wholesale/quotes')
      .send(withItems([{ productId: 'a', size: 'M', quantity: 10, unitPrice: 1 }], { estimatedPieces: 3, estimatedTotal: 1, discountPercent: 90 }))
      .expect(201);
    const data = prisma().wholesaleQuote.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data['items']).toEqual([{ productId: 'a', name: 'Camisa', size: 'M', quantity: 10, unitPrice: 95 }]);
    expect(data['estimatedTotal']).toBe(950);
    expect(data['discountPercent']).toBe(5);
    expect(data['estimatedPieces']).toBe(10); // vem da lista, não do campo enviado
    const extras = notify.mock.calls[0][1];
    expect(extras.estimatedTotal).toBe(950);
  });

  it('peça inexistente, tamanho inválido ou quantidade ruim: 400 e nada é gravado', async () => {
    prisma().product.findMany.mockResolvedValue(catalog as never);
    prisma().settings.findUnique.mockResolvedValue({ wholesaleTiers: null } as never);
    for (const bad of [
      [{ productId: 'zzz', size: 'M', quantity: 1 }],
      [{ productId: 'a', size: 'GG', quantity: 1 }],
      [{ productId: 'a', size: 'M', quantity: 0 }],
      [{ productId: 'a', size: 'M', quantity: 2.5 }],
    ]) {
      await request(app).post('/api/wholesale/quotes').send(withItems(bad)).expect(400);
    }
    expect(prisma().wholesaleQuote.create).not.toHaveBeenCalled();
  });

  it('sem peças o orçamento continua válido (formulário livre)', async () => {
    prisma().wholesaleQuote.create.mockResolvedValue({} as never);
    await request(app).post('/api/wholesale/quotes').send(valid).expect(201);
    expect(prisma().product.findMany).not.toHaveBeenCalled();
    expect((prisma().wholesaleQuote.create.mock.calls[0][0].data as Record<string, unknown>)['items']).toBeUndefined();
  });
});

describe('painel (dados pessoais de clientes: só admin)', () => {
  it('listar e marcar como atendido exigem admin', async () => {
    await request(app).get('/api/wholesale/quotes').expect(401);
    await request(app).get('/api/wholesale/quotes').set('Authorization', tokenFor('cliente')).expect(403);
    await request(app).patch('/api/wholesale/quotes/q1').send({ handled: true }).expect(401);
    await request(app).patch('/api/wholesale/quotes/q1').set('Authorization', tokenFor('cliente')).send({ handled: true }).expect(403);
    expect(prisma().wholesaleQuote.findMany).not.toHaveBeenCalled();
    expect(prisma().wholesaleQuote.update).not.toHaveBeenCalled();
  });

  it('lista com interesses como array, pendentes primeiro e limite', async () => {
    prisma().wholesaleQuote.findMany.mockResolvedValue([stored] as never);
    const res = await request(app).get('/api/wholesale/quotes').set(admin).expect(200);
    expect(res.body[0].interests).toEqual(['camisas', 'bonés']);
    expect(res.body[0].message).toBe('');
    expect(res.body[0].items).toEqual([]);
    expect(prisma().wholesaleQuote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200, orderBy: [{ handled: 'asc' }, { createdAt: 'desc' }] }),
    );
  });

  it('marcar atendido valida o tipo e devolve 404 para pedido inexistente', async () => {
    await request(app).patch('/api/wholesale/quotes/q1').set(admin).send({ handled: 'sim' }).expect(400);
    prisma().wholesaleQuote.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: 'x' }));
    await request(app).patch('/api/wholesale/quotes/zzz').set(admin).send({ handled: true }).expect(404);
    prisma().wholesaleQuote.update.mockResolvedValue({ ...stored, handled: true } as never);
    const ok = await request(app).patch('/api/wholesale/quotes/q1').set(admin).send({ handled: true }).expect(200);
    expect(ok.body.handled).toBe(true);
  });
});
