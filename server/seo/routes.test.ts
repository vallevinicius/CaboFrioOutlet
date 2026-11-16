import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { appWith } from '../test/helpers.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});

import { seoRouter } from './routes.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('', seoRouter);

beforeEach(() => mockReset(prisma()));

describe('sitemap.xml', () => {
  it('não lista peças que são só de atacado (a página de produto é do varejo)', async () => {
    prisma().product.findMany.mockResolvedValue([{ id: 'p1', updatedAt: new Date('2026-11-01') }] as never);
    const res = await request(app).get('/sitemap.xml').expect(200);
    expect(prisma().product.findMany.mock.calls[0][0]!.where).toEqual({ channel: { not: 'WHOLESALE' } });
    expect(res.text).toContain('/produto/p1');
  });
});
