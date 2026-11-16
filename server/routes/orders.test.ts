import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { FULL_EDIT, appWith, mockAccess, tokenFor } from '../test/helpers.js';
import { openCpf, sealCpf } from '../utils/cpf-vault.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});
vi.mock('../services/melhor-envio', () => ({ calculateShippingOptions: vi.fn().mockResolvedValue(null) }));
vi.mock('../services/stock', () => ({ expireStaleOrders: vi.fn(), restoreStockForOrder: vi.fn() }));

import { ordersRouter } from './orders.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/orders', ordersRouter);

const address = { cep: '28905-000', street: 'Rua A', number: '10', neighborhood: 'Centro', city: 'Cabo Frio', state: 'rj' };
const body = (over: object = {}) => ({
  customerName: 'Maria',
  customerContact: 'maria@exemplo.com',
  customerPhone: '(22) 99999-1234',
  customerCpf: '529.982.247-25',
  items: [{ productId: 'p1', size: 'M', quantity: 2 }],
  shippingAddress: address,
  ...over,
});
const product = { id: 'p1', name: 'Camisa', price: 100, discountPercent: 10, image: '/x.jpg', weightKg: 0.3, heightCm: 4, widthCm: 20, lengthCm: 25 };

beforeEach(() => {
  mockReset(prisma());
  mockAccess(prisma(), 'admin', { permissions: FULL_EDIT });
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

describe('POST /api/orders: dados do cliente guardados no pedido', () => {
  const arrange = () => {
    prisma().product.findUnique.mockResolvedValue(product as never);
    prisma().productSize.findUnique.mockResolvedValue({ id: 's1', stock: 10 } as never);
    prisma().order.create.mockResolvedValue({ id: 'ord1' } as never);
    prisma().order.update.mockImplementation((async (args: { data: object }) => ({ id: 'ord1', ...args.data, items: [] })) as never);
  };
  const created = () => prisma().order.create.mock.calls[0][0].data as Record<string, unknown>;

  it('visitante: telefone e CPF informados ficam no pedido, só com números', async () => {
    arrange();
    await request(app).post('/api/orders').send(body()).expect(201);
    // O CPF vai cifrado para o banco (ver "CPF cifrado"); aqui só conferimos que é o CPF informado.
    expect(created()).toMatchObject({ customerPhone: '22999991234' });
    expect(openCpf(created()['customerCpf'] as string)).toBe('52998224725');
  });

  it('visitante sem telefone, com telefone curto ou com CPF inválido: 400 e nada é reservado', async () => {
    arrange();
    await request(app).post('/api/orders').send(body({ customerPhone: undefined })).expect(400);
    await request(app).post('/api/orders').send(body({ customerPhone: '999' })).expect(400);
    await request(app).post('/api/orders').send(body({ customerCpf: '111.111.111-11' })).expect(400);
    await request(app).post('/api/orders').send(body({ customerCpf: undefined })).expect(400);
    expect(prisma().$transaction).not.toHaveBeenCalled();
    expect(prisma().order.create).not.toHaveBeenCalled();
  });

  it('cliente logado: telefone e CPF vêm do cadastro (o que o navegador enviar é ignorado) e o pedido fica ligado à conta', async () => {
    arrange();
    prisma().user.findUnique.mockResolvedValue({ cpf: '39053344705', phone: '(21) 98888-7777' } as never);
    await request(app)
      .post('/api/orders')
      .set('Authorization', tokenFor('user-A'))
      .send(body({ customerPhone: '(11) 90000-0000', customerCpf: '529.982.247-25' }))
      .expect(201);
    expect(created()).toMatchObject({ userId: 'user-A', customerPhone: '21988887777' });
    expect(openCpf(created()['customerCpf'] as string)).toBe('39053344705');
  });

  it('cliente logado não precisa reenviar telefone nem CPF', async () => {
    arrange();
    prisma().user.findUnique.mockResolvedValue({ cpf: '39053344705', phone: '21988887777' } as never);
    await request(app)
      .post('/api/orders')
      .set('Authorization', tokenFor('user-A'))
      .send(body({ customerPhone: undefined, customerCpf: undefined }))
      .expect(201);
    expect(created()).toMatchObject({ customerPhone: '21988887777' });
    expect(openCpf(created()['customerCpf'] as string)).toBe('39053344705');
  });

  it('conta apagada (token antigo): cai no caso de visitante e exige os dados', async () => {
    arrange();
    prisma().user.findUnique.mockResolvedValue(null as never);
    await request(app).post('/api/orders').set('Authorization', tokenFor('user-X')).send(body({ customerPhone: undefined })).expect(400);
  });
});

describe('POST /api/orders: CPF cifrado', () => {
  const arrange = () => {
    prisma().product.findUnique.mockResolvedValue(product as never);
    prisma().productSize.findUnique.mockResolvedValue({ id: 's1', stock: 10 } as never);
    prisma().order.create.mockResolvedValue({ id: 'ord1' } as never);
  };

  it('o CPF vai cifrado para o banco (nunca em texto puro) e a resposta traz só os números', async () => {
    arrange();
    prisma().order.update.mockImplementation((async (args: { data: object }) => ({ id: 'ord1', customerCpf: sealCpf('52998224725').cpf, ...args.data, items: [] })) as never);
    const res = await request(app).post('/api/orders').send(body()).expect(201);
    const stored = (prisma().order.create.mock.calls[0][0].data as { customerCpf: string }).customerCpf;
    expect(stored.startsWith('enc:v1:')).toBe(true);
    expect(stored).not.toContain('52998224725');
    expect(openCpf(stored)).toBe('52998224725');
    expect(res.body.customerCpf).toBe('52998224725');
  });

  it('cliente logado: lê o CPF cifrado do cadastro, valida e grava de novo cifrado', async () => {
    arrange();
    prisma().order.update.mockImplementation((async (args: { data: object }) => ({ id: 'ord1', ...args.data, items: [] })) as never);
    prisma().user.findUnique.mockResolvedValue({ cpf: sealCpf('39053344705').cpf, phone: '21988887777' } as never);
    await request(app).post('/api/orders').set('Authorization', tokenFor('user-A')).send(body({ customerCpf: undefined, customerPhone: undefined })).expect(201);
    const stored = (prisma().order.create.mock.calls[0][0].data as { customerCpf: string }).customerCpf;
    expect(openCpf(stored)).toBe('39053344705');
  });

  it('lista do admin: CPF do pedido e da conta saem abertos', async () => {
    prisma().order.findMany.mockResolvedValue([{ id: 'o1', userId: 'u1', customerContact: 'a@a.com', customerName: 'A', customerCpf: sealCpf('52998224725').cpf, items: [] }] as never);
    prisma().user.findMany.mockResolvedValue([{ id: 'u1', name: 'A', email: 'a@a.com', cpf: sealCpf('39053344705').cpf, phone: '', cep: '', street: '', number: '', complement: null, neighborhood: '', city: '', state: '', createdAt: new Date() }] as never);
    const res = await request(app).get('/api/orders').set('Authorization', tokenFor('admin', true)).expect(200);
    expect(res.body[0].customerCpf).toBe('52998224725');
    expect(res.body[0].account.cpf).toBe('39053344705');
    expect(JSON.stringify(res.body)).not.toContain('enc:v1');
  });

  it('"Meus pedidos" e a troca de status também devolvem o CPF aberto', async () => {
    const sealed = sealCpf('52998224725').cpf;
    prisma().order.findMany.mockResolvedValue([{ id: 'o1', customerCpf: sealed, items: [] }] as never);
    const mine = await request(app).get('/api/orders/mine').set('Authorization', tokenFor('user-A')).expect(200);
    expect(mine.body[0].customerCpf).toBe('52998224725');
    prisma().order.update.mockResolvedValue({ id: 'o1', status: 'enviado', customerCpf: sealed, items: [] } as never);
    const patched = await request(app).patch('/api/orders/o1/status').set('Authorization', tokenFor('admin', true)).send({ status: 'enviado' }).expect(200);
    expect(patched.body.customerCpf).toBe('52998224725');
  });

  it('pedido antigo, sem CPF gravado, não quebra', async () => {
    prisma().order.findMany.mockResolvedValue([{ id: 'o1', userId: null, customerContact: 'a@a.com', customerName: 'A', customerCpf: null, items: [] }] as never);
    prisma().user.findMany.mockResolvedValue([] as never);
    const res = await request(app).get('/api/orders').set('Authorization', tokenFor('admin', true)).expect(200);
    expect(res.body[0].customerCpf).toBeNull();
  });
});

describe('POST /api/orders: canal de venda', () => {
  it('produto só de atacado não pode ser comprado no varejo: 400 e nada é reservado', async () => {
    prisma().product.findUnique.mockResolvedValue({ ...product, channel: 'WHOLESALE' } as never);
    const res = await request(app).post('/api/orders').send(body()).expect(400);
    expect(res.body.error).toMatch(/atacado/i);
    expect(prisma().productSize.update).not.toHaveBeenCalled();
    expect(prisma().order.create).not.toHaveBeenCalled();
  });
  it('pedido de atacado com peça só de varejo é recusado', async () => {
    prisma().product.findUnique.mockResolvedValue({ ...product, channel: 'RETAIL' } as never);
    const res = await request(app).post('/api/orders').send(body({ wholesale: true, items: [{ productId: 'p1', size: 'M', quantity: 10 }] })).expect(400);
    expect(res.body.error).toMatch(/varejo/i);
    expect(prisma().productSize.update).not.toHaveBeenCalled();
  });
  it('produto de varejo ou dos dois canais passa normalmente', async () => {
    prisma().productSize.findUnique.mockResolvedValue({ id: 's1', stock: 10 } as never);
    prisma().order.create.mockResolvedValue({ id: 'ord1' } as never);
    prisma().order.update.mockImplementation((async (args: { data: object }) => ({ id: 'ord1', ...args.data, items: [] })) as never);
    for (const channel of ['RETAIL', 'BOTH']) {
      prisma().product.findUnique.mockResolvedValue({ ...product, channel } as never);
      await request(app).post('/api/orders').send(body()).expect(201);
    }
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

describe('GET /api/orders (admin): cliente do pedido', () => {
  const account = (over: object = {}) => ({
    id: 'u1', name: 'Maria Souza', email: 'maria@exemplo.com', cpf: '52998224725', phone: '(22) 99999-1234',
    cep: '28905000', street: 'Rua A', number: '10', complement: null, neighborhood: 'Centro', city: 'Cabo Frio', state: 'RJ',
    createdAt: new Date('2026-10-01T10:00:00Z'), ...over,
  });
  const order = (over: object = {}) => ({ id: 'o1', userId: null, customerName: 'Maria', customerContact: 'maria@exemplo.com', items: [], ...over });
  const admin = { Authorization: tokenFor('admin', true) };

  it('pedido de conta logada traz os dados do cadastro', async () => {
    prisma().order.findMany.mockResolvedValue([order({ userId: 'u1' })] as never);
    prisma().user.findMany.mockResolvedValue([account()] as never);
    const res = await request(app).get('/api/orders').set(admin).expect(200);
    expect(res.body[0].account).toMatchObject({ id: 'u1', name: 'Maria Souza', cpf: '52998224725', phone: '(22) 99999-1234', city: 'Cabo Frio', linkedBy: 'account' });
  });

  it('pedido de visitante é juntado à conta de mesmo e-mail (sem diferenciar maiúsculas), sem alterar o pedido', async () => {
    prisma().order.findMany.mockResolvedValue([order({ customerContact: 'MARIA@Exemplo.com' })] as never);
    prisma().user.findMany.mockResolvedValue([account()] as never);
    const res = await request(app).get('/api/orders').set(admin).expect(200);
    expect(res.body[0].account).toMatchObject({ id: 'u1', linkedBy: 'email' });
    expect(prisma().order.update).not.toHaveBeenCalled();
  });

  it('sem conta correspondente: account é null', async () => {
    prisma().order.findMany.mockResolvedValue([order({ customerContact: 'outro@exemplo.com' })] as never);
    prisma().user.findMany.mockResolvedValue([] as never);
    const res = await request(app).get('/api/orders').set(admin).expect(200);
    expect(res.body[0].account).toBeNull();
  });

  it('nunca expõe o hash da senha e só pede à conta os campos necessários', async () => {
    prisma().order.findMany.mockResolvedValue([order({ userId: 'u1' })] as never);
    prisma().user.findMany.mockResolvedValue([{ ...account(), passwordHash: 'segredo' }] as never);
    const res = await request(app).get('/api/orders').set(admin).expect(200);
    expect(JSON.stringify(res.body)).not.toContain('segredo');
    const select = prisma().user.findMany.mock.calls[0][0]!.select as Record<string, boolean>;
    expect(select['passwordHash']).toBeUndefined();
  });

  it('sem pedidos, nem consulta contas', async () => {
    prisma().order.findMany.mockResolvedValue([] as never);
    await request(app).get('/api/orders').set(admin).expect(200);
    expect(prisma().user.findMany).not.toHaveBeenCalled();
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
