import request from 'supertest';
import { Prisma, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { appWith, mockAccess, tokenFor } from '../test/helpers.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});

import { rolesRouter } from './roles.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/roles', rolesRouter);
const supreme = { Authorization: tokenFor('s1', true) };

const stored = (over: object = {}) => ({
  id: 'r1',
  name: 'Estoquista',
  system: false,
  permissions: [{ section: 'produtos', level: 'EDIT' }, { section: 'pedidos', level: 'VIEW' }],
  _count: { users: 0 },
  ...over,
});
const input = (over: object = {}) => ({
  name: 'Estoquista',
  permissions: [{ section: 'produtos', level: 'edit' }, { section: 'pedidos', level: 'view' }],
  ...over,
});
const p2002 = () => new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '6' });

beforeEach(() => {
  mockReset(prisma());
  mockAccess(prisma(), 's1', { isSuperAdmin: true });
  prisma().$transaction.mockImplementation((async (cb: (tx: unknown) => unknown) => cb(prisma())) as never);
});

describe('acesso: só o admin supremo', () => {
  it('sem token 401; cliente 403; admin com perfil 403', async () => {
    await request(app).get('/api/roles').expect(401);
    mockAccess(prisma(), 'c1', { isAdmin: false });
    await request(app).get('/api/roles').set('Authorization', tokenFor('c1')).expect(403);
    mockAccess(prisma(), 'a1', { permissions: { produtos: 'edit' } });
    await request(app).post('/api/roles').set('Authorization', tokenFor('a1', true)).send(input()).expect(403);
    expect(prisma().role.create).not.toHaveBeenCalled();
  });
});

describe('GET', () => {
  it('lista perfis como DTO (níveis em minúsculas, com quantidade de usuários)', async () => {
    prisma().role.findMany.mockResolvedValue([stored({ _count: { users: 2 } })] as never);
    const res = await request(app).get('/api/roles').set(supreme).expect(200);
    expect(res.body).toEqual([
      {
        id: 'r1',
        name: 'Estoquista',
        system: false,
        userCount: 2,
        permissions: [{ section: 'produtos', level: 'edit' }, { section: 'pedidos', level: 'view' }],
      },
    ]);
  });
  it('perfil inexistente → 404', async () => {
    prisma().role.findUnique.mockResolvedValue(null);
    await request(app).get('/api/roles/nada').set(supreme).expect(404);
  });
});

describe('POST /api/roles', () => {
  it('cria o perfil (201) gravando VIEW/EDIT', async () => {
    prisma().role.create.mockResolvedValue(stored() as never);
    const res = await request(app).post('/api/roles').set(supreme).send(input()).expect(201);
    expect(res.body.name).toBe('Estoquista');
    const data = prisma().role.create.mock.calls[0][0].data as { permissions: { create: unknown[] } };
    expect(data.permissions.create).toEqual([
      { section: 'produtos', level: 'EDIT' },
      { section: 'pedidos', level: 'VIEW' },
    ]);
  });

  it('seção inexistente ou nível inválido → 422 e nada é gravado', async () => {
    await request(app).post('/api/roles').set(supreme).send(input({ permissions: [{ section: 'equipe', level: 'edit' }] })).expect(422);
    await request(app).post('/api/roles').set(supreme).send(input({ permissions: [{ section: 'produtos', level: 'admin' }] })).expect(422);
    expect(prisma().role.create).not.toHaveBeenCalled();
  });

  it('seção repetida, nome vazio ou nome enorme → 422', async () => {
    const dup = [{ section: 'produtos', level: 'view' }, { section: 'produtos', level: 'edit' }];
    await request(app).post('/api/roles').set(supreme).send(input({ permissions: dup })).expect(422);
    await request(app).post('/api/roles').set(supreme).send(input({ name: '   ' })).expect(422);
    await request(app).post('/api/roles').set(supreme).send(input({ name: 'x'.repeat(41) })).expect(422);
    expect(prisma().role.create).not.toHaveBeenCalled();
  });

  it('nome já usado → 409', async () => {
    prisma().role.create.mockRejectedValue(p2002());
    await request(app).post('/api/roles').set(supreme).send(input()).expect(409);
  });
});

describe('PUT /api/roles/:id', () => {
  it('troca nome e permissões numa transação', async () => {
    prisma().role.findUnique.mockResolvedValue(stored() as never);
    prisma().role.update.mockResolvedValue(stored({ name: 'Novo' }) as never);
    await request(app).put('/api/roles/r1').set(supreme).send(input({ name: 'Novo', permissions: [] })).expect(200);
    expect(prisma().$transaction).toHaveBeenCalled();
    expect(prisma().rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'r1' } });
  });
  it('perfil de sistema é imutável → 403', async () => {
    prisma().role.findUnique.mockResolvedValue(stored({ system: true }) as never);
    await request(app).put('/api/roles/r1').set(supreme).send(input()).expect(403);
    expect(prisma().role.update).not.toHaveBeenCalled();
  });
  it('inexistente → 404; nome repetido → 409', async () => {
    prisma().role.findUnique.mockResolvedValue(null);
    await request(app).put('/api/roles/x').set(supreme).send(input()).expect(404);
    prisma().role.findUnique.mockResolvedValue(stored() as never);
    prisma().role.update.mockRejectedValue(p2002());
    await request(app).put('/api/roles/r1').set(supreme).send(input()).expect(409);
  });
});

describe('DELETE /api/roles/:id', () => {
  it('apaga perfil sem usuários (204)', async () => {
    prisma().role.findUnique.mockResolvedValue(stored() as never);
    await request(app).delete('/api/roles/r1').set(supreme).expect(204);
    expect(prisma().role.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });
  it('perfil em uso → 409 e nada é apagado', async () => {
    prisma().role.findUnique.mockResolvedValue(stored({ _count: { users: 3 } }) as never);
    const res = await request(app).delete('/api/roles/r1').set(supreme).expect(409);
    expect(res.body.error).toContain('3');
    expect(prisma().role.delete).not.toHaveBeenCalled();
  });
  it('perfil de sistema → 403; inexistente → 404', async () => {
    prisma().role.findUnique.mockResolvedValue(stored({ system: true }) as never);
    await request(app).delete('/api/roles/r1').set(supreme).expect(403);
    prisma().role.findUnique.mockResolvedValue(null);
    await request(app).delete('/api/roles/r1').set(supreme).expect(404);
    expect(prisma().role.delete).not.toHaveBeenCalled();
  });
});
