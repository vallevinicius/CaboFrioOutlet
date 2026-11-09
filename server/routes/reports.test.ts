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

import { reportsRouter } from './reports';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/reports', reportsRouter);

beforeEach(() => {
  mockReset(prisma());
  prisma().order.findMany.mockResolvedValue([] as never);
  prisma().product.findMany.mockResolvedValue([] as never);
});

describe('GET /api/reports/overview', () => {
  it('dados de venda são só do administrador (401 sem token, 403 para cliente)', async () => {
    await request(app).get('/api/reports/overview').expect(401);
    await request(app).get('/api/reports/overview').set('Authorization', tokenFor('cliente', false)).expect(403);
    expect(prisma().order.findMany).not.toHaveBeenCalled();
  });

  it('admin recebe o resumo e o estoque baixo; período inválido vira 30 dias', async () => {
    prisma().product.findMany.mockResolvedValue([{ id: 'p', name: 'Boné', sizes: [{ size: 'U', stock: 0 }] }] as never);
    const res = await request(app).get('/api/reports/overview?days=999').set('Authorization', tokenFor('admin', true)).expect(200);
    expect(res.body.overview.periodDays).toBe(30);
    expect(res.body.overview.series).toHaveLength(30);
    expect(res.body.lowStock.outOfStock).toBe(1);
  });

  it('aceita 7 e 90 dias e limita a consulta de pedidos', async () => {
    const auth = { Authorization: tokenFor('admin', true) };
    const r7 = await request(app).get('/api/reports/overview?days=7').set(auth).expect(200);
    expect(r7.body.overview.periodDays).toBe(7);
    expect(prisma().order.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5000 }));
  });
});
