import request from 'supertest';
import { Prisma, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { FULL_EDIT, appWith, mockAccess, tokenFor } from '../test/helpers.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});

import { productsRouter } from './products.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/products', productsRouter);
const admin = { Authorization: tokenFor('admin', true) };
const valid = {
  name: 'Camisa',
  price: 99.9,
  category: 'camisas',
  image: '/uploads/capa.jpg',
  images: ['/uploads/a.jpg'],
  description: 'x',
  sizes: ['M'],
  stock: { M: 3 },
};

beforeEach(() => {
  mockReset(prisma());
  mockAccess(prisma(), 'admin', { permissions: FULL_EDIT });
});

describe('produtos: acesso', () => {
  it('listar é público; criar, editar, estoque e apagar exigem admin', async () => {
    prisma().product.findMany.mockResolvedValue([] as never);
    await request(app).get('/api/products').expect(200);
    await request(app).post('/api/products').send(valid).expect(401);
    await request(app).post('/api/products').set('Authorization', tokenFor('cliente')).send(valid).expect(403);
    await request(app).put('/api/products/p1').set('Authorization', tokenFor('cliente')).send(valid).expect(403);
    await request(app).put('/api/products/p1/stock').send({ size: 'M', quantity: 1 }).expect(401);
    await request(app).delete('/api/products/p1').set('Authorization', tokenFor('cliente')).expect(403);
    expect(prisma().product.create).not.toHaveBeenCalled();
    expect(prisma().product.delete).not.toHaveBeenCalled();
  });
});

describe('produtos: validação', () => {
  it('rejeita dados incompletos e preço inválido', async () => {
    await request(app).post('/api/products').set(admin).send({ ...valid, name: ' ' }).expect(400);
    await request(app).post('/api/products').set(admin).send({ ...valid, price: 0 }).expect(400);
    await request(app).post('/api/products').set(admin).send({ ...valid, sizes: [] }).expect(400);
  });

  it('rejeita fotos adicionais com esquema perigoso ou em excesso', async () => {
    await request(app).post('/api/products').set(admin).send({ ...valid, images: ['javascript:alert(1)'] }).expect(400);
    await request(app)
      .post('/api/products')
      .set(admin)
      .send({ ...valid, images: Array.from({ length: 9 }, (_, i) => `/uploads/${i}.jpg`) })
      .expect(400);
    expect(prisma().product.create).not.toHaveBeenCalled();
  });

  it('cria com fotos adicionais (sem repetir a capa) e estoque não negativo', async () => {
    prisma().product.create.mockResolvedValue({ id: 'p1', ...valid, brand: null, discountPercent: null, isNew: false, sizes: [], images: [] } as never);
    await request(app)
      .post('/api/products')
      .set(admin)
      .send({ ...valid, images: ['/uploads/capa.jpg', '/uploads/b.jpg'], stock: { M: -5 } })
      .expect(201);
    const data = prisma().product.create.mock.calls[0][0].data as {
      images: { create: { url: string }[] };
      sizes: { create: { stock: number }[] };
    };
    expect(data.images.create.map((i) => i.url)).toEqual(['/uploads/b.jpg']);
    expect(data.sizes.create[0].stock).toBe(0);
  });

  it('editar produto inexistente devolve 404 (não 500)', async () => {
    prisma().$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2003', clientVersion: 'x' }) as never);
    await request(app).put('/api/products/naoexiste').set(admin).send(valid).expect(404);
  });
});

describe('DELETE /api/products/:id/stock/:size (remover tamanho)', () => {
  const stored = (sizes: string[]) => ({ id: 'p1', sizes: sizes.map((size) => ({ id: size, size, stock: 2 })), images: [] });
  const url = '/api/products/p1/stock/M';

  beforeEach(() => {
    prisma().$transaction.mockImplementation((async (cb: (tx: unknown) => unknown) => cb(prisma())) as never);
    prisma().product.findUnique.mockResolvedValue({ id: 'p1' } as never);
  });

  it('remove o tamanho e devolve o produto atualizado', async () => {
    prisma().productSize.findMany.mockResolvedValue([{ size: 'P' }, { size: 'M' }] as never);
    prisma().product.findUniqueOrThrow.mockResolvedValue({ ...valid, ...stored(['P']), createdAt: new Date(), brand: null, discountPercent: null, isNew: false } as never);
    const res = await request(app).delete(url).set(admin).expect(200);
    expect(prisma().productSize.delete).toHaveBeenCalledWith({ where: { productId_size: { productId: 'p1', size: 'M' } } });
    expect(res.body.sizes).toEqual(['P']);
  });

  it('não remove o último tamanho (o produto precisa de ao menos um) → 409', async () => {
    prisma().productSize.findMany.mockResolvedValue([{ size: 'M' }] as never);
    await request(app).delete(url).set(admin).expect(409);
    expect(prisma().productSize.delete).not.toHaveBeenCalled();
  });

  it('tamanho que o produto não tem → 404', async () => {
    prisma().productSize.findMany.mockResolvedValue([{ size: 'P' }, { size: 'G' }] as never);
    await request(app).delete(url).set(admin).expect(404);
    expect(prisma().productSize.delete).not.toHaveBeenCalled();
  });

  it('produto inexistente → 404', async () => {
    prisma().product.findUnique.mockResolvedValue(null);
    await request(app).delete(url).set(admin).expect(404);
    expect(prisma().productSize.delete).not.toHaveBeenCalled();
  });

  it('aceita tamanho com espaço ou barra codificados (ex.: "2 / 3")', async () => {
    prisma().productSize.findMany.mockResolvedValue([{ size: '2 / 3' }, { size: 'P' }] as never);
    prisma().product.findUniqueOrThrow.mockResolvedValue({ ...valid, ...stored(['P']), createdAt: new Date(), brand: null, discountPercent: null, isNew: false } as never);
    await request(app).delete('/api/products/p1/stock/' + encodeURIComponent('2 / 3')).set(admin).expect(200);
    expect(prisma().productSize.delete).toHaveBeenCalledWith({ where: { productId_size: { productId: 'p1', size: '2 / 3' } } });
  });
});

describe('PUT /api/products/:id/stock (adicionar tamanho)', () => {
  it('recusa nome de tamanho com mais de 20 caracteres', async () => {
    await request(app).put('/api/products/p1/stock').set(admin).send({ size: 'X'.repeat(21), quantity: 0 }).expect(400);
    expect(prisma().productSize.upsert).not.toHaveBeenCalled();
  });
});

describe('canal de venda (varejo / atacado / ambos)', () => {
  const created = (over: object = {}) => ({ ...valid, id: 'p1', sizes: [{ id: 's', size: 'M', stock: 3 }], images: [], createdAt: new Date(), brand: null, discountPercent: null, isNew: false, channel: 'BOTH', ...over });

  it('novo produto sem canal vai para os dois (padrão)', async () => {
    prisma().product.create.mockResolvedValue(created() as never);
    await request(app).post('/api/products').set(admin).send(valid).expect(201);
    expect((prisma().product.create.mock.calls[0][0].data as { channel: string }).channel).toBe('BOTH');
  });

  it.each([['retail', 'RETAIL'], ['wholesale', 'WHOLESALE'], ['both', 'BOTH']])('cria com canal %s', async (api, db) => {
    prisma().product.create.mockResolvedValue(created({ channel: db }) as never);
    const res = await request(app).post('/api/products').set(admin).send({ ...valid, channel: api }).expect(201);
    expect((prisma().product.create.mock.calls[0][0].data as { channel: string }).channel).toBe(db);
    expect(res.body.channel).toBe(api);
  });

  it('canal desconhecido é recusado (400) e nada é gravado', async () => {
    await request(app).post('/api/products').set(admin).send({ ...valid, channel: 'varejo' }).expect(400);
    await request(app).put('/api/products/p1').set(admin).send({ ...valid, channel: 'todos' }).expect(400);
    expect(prisma().product.create).not.toHaveBeenCalled();
    expect(prisma().$transaction).not.toHaveBeenCalled();
  });

  it('editar com canal grava; editar sem canal NÃO muda o canal existente', async () => {
    prisma().$transaction.mockResolvedValue([] as never);
    prisma().product.findUniqueOrThrow.mockResolvedValue(created({ channel: 'WHOLESALE' }) as never);
    await request(app).put('/api/products/p1').set(admin).send({ ...valid, channel: 'wholesale' }).expect(200);
    await request(app).put('/api/products/p1').set(admin).send(valid).expect(200);
    const updates = prisma().product.update.mock.calls.map((c) => c[0].data as { channel?: string });
    expect(updates[0].channel).toBe('WHOLESALE');
    expect(updates[1]).not.toHaveProperty('channel');
  });

  it('a lista devolve o canal em minúsculas', async () => {
    prisma().product.findMany.mockResolvedValue([created({ channel: 'RETAIL' })] as never);
    const res = await request(app).get('/api/products').expect(200);
    expect(res.body[0].channel).toBe('retail');
  });
});
