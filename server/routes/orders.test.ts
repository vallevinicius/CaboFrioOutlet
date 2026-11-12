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
  prisma().settings.upsert.mockResolvedValue({ id: 1, freeShippingThreshold: 299, shippingFee: 19.9, wholesaleMinPieces: 10, wholesaleTiers: null } as never);
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

describe('POST /api/orders: atacado', () => {
  const wholesaleBody = (qty: number, over: object = {}) =>
    body({ wholesale: true, items: [{ productId: 'p1', size: 'M', quantity: qty }], ...over });

  function arrange() {
    prisma().product.findUnique.mockResolvedValue({ ...product, discountPercent: null, price: 100 } as never);
    prisma().productSize.findUnique.mockResolvedValue({ id: 's1', stock: 1000 } as never);
    prisma().order.create.mockResolvedValue({ id: 'ord1' } as never);
    prisma().order.update.mockImplementation((async (args: { data: object }) => ({ id: 'ord1', ...args.data, items: [] })) as never);
  }
  const created = () =>
    prisma().order.create.mock.calls[0][0].data as {
      isWholesale: boolean;
      wholesaleDiscountPercent: number | null;
      total: number;
      items: { create: { unitPrice: number }[] };
    };

  it('abaixo do mínimo (10 peças) é recusado e nada é reservado', async () => {
    arrange();
    const res = await request(app).post('/api/orders').send(wholesaleBody(9)).expect(400);
    expect(res.body.error).toContain('10 peças');
    expect(prisma().$transaction).not.toHaveBeenCalled();
  });

  it('no mínimo aplica a primeira faixa (5%) e marca o pedido como atacado', async () => {
    arrange();
    await request(app).post('/api/orders').send(wholesaleBody(10)).expect(201);
    expect(created()).toMatchObject({ isWholesale: true, wholesaleDiscountPercent: 5 });
    expect(created().items.create[0].unitPrice).toBe(95);
    expect(created().total).toBe(950);
  });

  it('mais peças, mais desconto (20 peças = 10%; 50 = 15%)', async () => {
    arrange();
    await request(app).post('/api/orders').send(wholesaleBody(20)).expect(201);
    expect(created().wholesaleDiscountPercent).toBe(10);
    mockReset(prisma());
    prisma().$transaction.mockImplementation((async (cb: (tx: unknown) => unknown) => cb(prisma())) as never);
    prisma().settings.upsert.mockResolvedValue({ id: 1, freeShippingThreshold: 299, shippingFee: 19.9, wholesaleMinPieces: 10, wholesaleTiers: null } as never);
    arrange();
    await request(app).post('/api/orders').send(wholesaleBody(50)).expect(201);
    expect(created().wholesaleDiscountPercent).toBe(15);
    expect(created().items.create[0].unitPrice).toBe(85);
  });

  it('usa as faixas editadas no admin, não as padrão', async () => {
    prisma().settings.upsert.mockResolvedValue({
      id: 1, freeShippingThreshold: 299, shippingFee: 19.9, wholesaleMinPieces: 5,
      wholesaleTiers: JSON.stringify([{ minPieces: 5, discountPercent: 20 }]),
    } as never);
    arrange();
    await request(app).post('/api/orders').send(wholesaleBody(5)).expect(201);
    expect(created().wholesaleDiscountPercent).toBe(20);
    expect(created().items.create[0].unitPrice).toBe(80);
  });

  it('o cliente não consegue definir o desconto: percentual enviado é ignorado', async () => {
    arrange();
    await request(app).post('/api/orders').send(wholesaleBody(10, { wholesaleDiscountPercent: 90, discountPercent: 90 })).expect(201);
    expect(created().wholesaleDiscountPercent).toBe(5);
    expect(created().items.create[0].unitPrice).toBe(95);
  });

  it('sem a marca de atacado, a quantidade NÃO gera desconto (compra normal da loja)', async () => {
    arrange();
    await request(app).post('/api/orders').send(body({ items: [{ productId: 'p1', size: 'M', quantity: 30 }] })).expect(201);
    expect(created()).toMatchObject({ isWholesale: false, wholesaleDiscountPercent: null });
    expect(created().items.create[0].unitPrice).toBe(100);
  });

  it('quantidade quebrada ou negativa é recusada antes de mexer no estoque', async () => {
    await request(app).post('/api/orders').send(wholesaleBody(10.5)).expect(400);
    await request(app).post('/api/orders').send(wholesaleBody(-10)).expect(400);
    expect(prisma().$transaction).not.toHaveBeenCalled();
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
