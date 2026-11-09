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

import { productsRouter } from './products';

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

beforeEach(() => mockReset(prisma()));

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
