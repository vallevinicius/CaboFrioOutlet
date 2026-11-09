import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { appWith, tokenFor } from '../test/helpers';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});
vi.mock('../services/melhor-envio', () => ({ calculateShippingOptions: vi.fn().mockResolvedValue(null) }));
vi.mock('../services/stock', () => ({ expireStaleOrders: vi.fn(), restoreStockForOrder: vi.fn() }));

import { ordersRouter } from './orders';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/orders', ordersRouter);

const address = { cep: '28905-000', street: 'Rua A', number: '10', neighborhood: 'Centro', city: 'Cabo Frio', state: 'rj' };
const body = (over: object = {}) => ({
  customerName: 'Maria',
  customerContact: 'maria@exemplo.com',
  items: [{ productId: 'p1', size: 'M', quantity: 2 }],
  shippingAddress: address,
  ...over,
});
const product = { id: 'p1', name: 'Camisa', price: 100, discountPercent: 10, image: '/x.jpg', weightKg: 0.3, heightCm: 4, widthCm: 20, lengthCm: 25 };

beforeEach(() => {
  mockReset(prisma());
  prisma().$transaction.mockImplementation((async (cb: (tx: unknown) => unknown) => cb(prisma())) as never);
  prisma().settings.upsert.mockResolvedValue({ id: 1, freeShippingThreshold: 299, shippingFee: 19.9 } as never);
});

describe('POST /api/orders: validação', () => {
  it('exige nome, contato e itens', async () => {
    await request(app).post('/api/orders').send(body({ customerName: '' })).expect(400);
    await request(app).post('/api/orders').send(body({ items: [] })).expect(400);
  });
  it('exige endereço de entrega completo e CEP com 8 dígitos', async () => {
    await request(app).post('/api/orders').send(body({ shippingAddress: { ...address, cep: '123' } })).expect(400);
    await request(app).post('/api/orders').send(body({ shippingAddress: { ...address, street: '' } })).expect(400);
    expect(prisma().$transaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/orders: preço e estoque', () => {
  it('calcula o preço pelo catálogo (com desconto) e ignora preço enviado pelo cliente', async () => {
    prisma().product.findUnique.mockResolvedValue(product as never);
    prisma().productSize.findUnique.mockResolvedValue({ id: 's1', stock: 10 } as never);
    prisma().order.create.mockResolvedValue({ id: 'ord1' } as never);
    prisma().order.update.mockImplementation((async (args: { data: object }) => ({ id: 'ord1', ...args.data, items: [] })) as never);

    const res = await request(app)
      .post('/api/orders')
      .send(body({ items: [{ productId: 'p1', size: 'M', quantity: 2, unitPrice: 1, price: 1 }], total: 1 }))
      .expect(201);

    const created = prisma().order.create.mock.calls[0][0].data as { total: number; items: { create: { unitPrice: number }[] } };
    expect(created.items.create[0].unitPrice).toBe(90);
    expect(created.total).toBe(180);
    // 180 < 299 e sem Melhor Envio: frete fixo de 19,90
    expect(res.body.total).toBeCloseTo(199.9);
    expect(res.body.shippingCost).toBe(19.9);
  });

  it('baixa o estoque de forma atômica (decrement) e frete grátis acima do limite', async () => {
    prisma().product.findUnique.mockResolvedValue({ ...product, discountPercent: null, price: 200 } as never);
    prisma().productSize.findUnique.mockResolvedValue({ id: 's1', stock: 10 } as never);
    prisma().order.create.mockResolvedValue({ id: 'ord1' } as never);
    prisma().order.update.mockImplementation((async (args: { data: object }) => ({ id: 'ord1', ...args.data, items: [] })) as never);
    const res = await request(app).post('/api/orders').send(body()).expect(201);
    expect(prisma().productSize.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { stock: { decrement: 2 } } });
    expect(res.body.shippingCost).toBe(0);
  });

  it('estoque insuficiente: 400 com mensagem e pedido não é criado', async () => {
    prisma().product.findUnique.mockResolvedValue(product as never);
    prisma().productSize.findUnique.mockResolvedValue({ id: 's1', stock: 1 } as never);
    const res = await request(app).post('/api/orders').send(body()).expect(400);
    expect(res.body.error).toContain('Estoque insuficiente');
    expect(prisma().order.create).not.toHaveBeenCalled();
  });

  it('produto inexistente e quantidade inválida são recusados', async () => {
    prisma().product.findUnique.mockResolvedValue(null as never);
    await request(app).post('/api/orders').send(body()).expect(400);
    await request(app).post('/api/orders').send(body({ items: [{ productId: 'p1', size: 'M', quantity: -3 }] })).expect(400);
  });

  it('pedido de visitante não fica ligado a nenhuma conta; de cliente logado, fica', async () => {
    prisma().product.findUnique.mockResolvedValue(product as never);
    prisma().productSize.findUnique.mockResolvedValue({ id: 's1', stock: 10 } as never);
    prisma().order.create.mockResolvedValue({ id: 'ord1' } as never);
    prisma().order.update.mockImplementation((async (args: { data: object }) => ({ id: 'ord1', ...args.data, items: [] })) as never);
    await request(app).post('/api/orders').send(body()).expect(201);
    expect((prisma().order.create.mock.calls[0][0].data as { userId?: string }).userId).toBeUndefined();
    await request(app).post('/api/orders').set('Authorization', tokenFor('user-A')).send(body()).expect(201);
    expect((prisma().order.create.mock.calls[1][0].data as { userId?: string }).userId).toBe('user-A');
  });
});

describe('rotas protegidas de pedidos', () => {
  it('lista geral só para admin; "meus pedidos" filtra pelo usuário do token', async () => {
    await request(app).get('/api/orders').expect(401);
    await request(app).get('/api/orders').set('Authorization', tokenFor('cliente')).expect(403);
    prisma().order.findMany.mockResolvedValue([] as never);
    await request(app).get('/api/orders/mine').set('Authorization', tokenFor('user-A')).expect(200);
    expect(prisma().order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-A' } }));
  });

  it('mudar status exige admin e rejeita status inválido', async () => {
    await request(app).patch('/api/orders/o1/status').send({ status: 'enviado' }).expect(401);
    await request(app).patch('/api/orders/o1/status').set('Authorization', tokenFor('cliente')).send({ status: 'enviado' }).expect(403);
    await request(app).patch('/api/orders/o1/status').set('Authorization', tokenFor('admin', true)).send({ status: 'inventado' }).expect(400);
    expect(prisma().order.update).not.toHaveBeenCalled();
  });
});
