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

import { favoritesRouter } from './favorites';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/favorites', favoritesRouter);

beforeEach(() => mockReset(prisma()));

describe('favoritos: autenticação', () => {
  it('sem token, todas as rotas respondem 401 e nada toca o banco', async () => {
    await request(app).get('/api/favorites').expect(401);
    await request(app).put('/api/favorites/abc12345').expect(401);
    await request(app).delete('/api/favorites/abc12345').expect(401);
    await request(app).post('/api/favorites/merge').send({ productIds: [] }).expect(401);
    expect(prisma().favorite.findMany).not.toHaveBeenCalled();
  });
  it('token inválido responde 401', async () => {
    await request(app).get('/api/favorites').set('Authorization', 'Bearer lixo').expect(401);
  });
});

describe('favoritos: isolamento entre contas (IDOR)', () => {
  it('GET lista só os favoritos do dono do token', async () => {
    prisma().favorite.findMany.mockResolvedValue([{ productId: 'p1' }, { productId: 'p2' }] as never);
    const res = await request(app).get('/api/favorites').set('Authorization', tokenFor('user-A')).expect(200);
    expect(res.body).toEqual({ productIds: ['p1', 'p2'] });
    expect(prisma().favorite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-A' } }));
  });

  it('DELETE só remove do dono do token, mesmo que o id seja de outro usuário', async () => {
    prisma().favorite.deleteMany.mockResolvedValue({ count: 0 } as never);
    await request(app).delete('/api/favorites/prod1').set('Authorization', tokenFor('user-A')).expect(204);
    expect(prisma().favorite.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-A', productId: 'prod1' } });
  });

  it('PUT grava sempre com o userId do token', async () => {
    prisma().favorite.count.mockResolvedValue(0 as never);
    prisma().favorite.findUnique.mockResolvedValue(null as never);
    prisma().favorite.upsert.mockResolvedValue({} as never);
    await request(app).put('/api/favorites/prod1').set('Authorization', tokenFor('user-B')).expect(204);
    expect(prisma().favorite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { userId: 'user-B', productId: 'prod1' } }),
    );
  });
});

describe('favoritos: validação e erros', () => {
  const auth = { Authorization: tokenFor('user-A') };

  it('rejeita id com caracteres perigosos', async () => {
    await request(app).put("/api/favorites/x';DROP").set(auth).expect(400);
    expect(prisma().favorite.upsert).not.toHaveBeenCalled();
  });

  it('produto inexistente (P2003) vira 404, não 500', async () => {
    prisma().favorite.count.mockResolvedValue(0 as never);
    prisma().favorite.findUnique.mockResolvedValue(null as never);
    prisma().favorite.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x' }),
    );
    await request(app).put('/api/favorites/naoexiste1').set(auth).expect(404);
  });

  it('limite de favoritos devolve 409', async () => {
    prisma().favorite.count.mockResolvedValue(200 as never);
    prisma().favorite.findUnique.mockResolvedValue(null as never);
    await request(app).put('/api/favorites/prod1').set(auth).expect(409);
  });

  it('merge rejeita lista inválida e ignora produtos que não existem', async () => {
    await request(app).post('/api/favorites/merge').set(auth).send({ productIds: 'x' }).expect(400);
    prisma().product.findMany.mockResolvedValue([{ id: 'ok1' }] as never);
    prisma().favorite.createMany.mockResolvedValue({ count: 1 } as never);
    prisma().favorite.findMany.mockResolvedValue([{ productId: 'ok1' }] as never);
    const res = await request(app).post('/api/favorites/merge').set(auth).send({ productIds: ['ok1', 'fantasma'] }).expect(200);
    expect(prisma().favorite.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-A', productId: 'ok1' }],
      skipDuplicates: true,
    });
    expect(res.body.productIds).toEqual(['ok1']);
  });
});
