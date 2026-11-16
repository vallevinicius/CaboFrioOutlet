import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { appWith, mockAccess, tokenFor } from '../test/helpers.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});

import { usersRouter } from './users.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/users', usersRouter);

beforeEach(() => mockReset(prisma()));

describe('GET /api/users', () => {
  it('lista as contas sem expor o hash da senha', async () => {
    mockAccess(prisma(), 'u1', { permissions: { clientes: 'view' } });
    prisma().user.findMany.mockResolvedValue([
      { id: 'c1', name: 'Ana', email: 'ana@x.com', passwordHash: 'segredo', cpf: 'equipe-abc123', phone: '', cep: '', street: '', number: '', complement: null, neighborhood: '', city: '', state: '', isAdmin: false, createdAt: new Date() },
    ] as never);
    const res = await request(app).get('/api/users').set('Authorization', tokenFor('u1', true)).expect(200);
    expect(res.body[0].email).toBe('ana@x.com');
    expect(JSON.stringify(res.body)).not.toContain('segredo');
    expect(res.body[0]).not.toHaveProperty('passwordHash');
    expect(res.body[0].cpf).toBe(''); // marcador interno de conta da equipe não vaza
  });
});

describe('promoção a admin', () => {
  it('PATCH /api/users/:id/admin não existe mais (promover é só pela aba Equipe)', async () => {
    mockAccess(prisma(), 's1', { isSuperAdmin: true });
    await request(app).patch('/api/users/c1/admin').set('Authorization', tokenFor('s1', true)).send({ isAdmin: true }).expect(404);
    expect(prisma().user.update).not.toHaveBeenCalled();
  });
});
