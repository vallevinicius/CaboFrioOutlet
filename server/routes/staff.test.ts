import request from 'supertest';
import bcrypt from 'bcryptjs';
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

import { staffRouter } from './staff.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/staff', staffRouter);
const supreme = { Authorization: tokenFor('s1', true) };

const member = (over: object = {}) => ({
  id: 'm1',
  name: 'Marina',
  email: 'marina@loja.com',
  isSuperAdmin: false,
  createdAt: new Date('2026-11-16T12:00:00Z'),
  role: { id: 'r1', name: 'Atendimento' },
  ...over,
});
const body = (over: object = {}) => ({ name: 'Marina', email: 'marina@loja.com', password: 'senha-provisoria', roleId: 'r1', ...over });
const p2002 = () => new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '6' });

/** O supremo `s1` autoriza; os alvos são resolvidos pelo mesmo findUnique. */
function targets(map: Record<string, object | null>) {
  mockAccess(prisma(), 's1', { isSuperAdmin: true }, (id) => map[id] ?? null);
}

beforeEach(() => {
  mockReset(prisma());
  targets({});
  prisma().role.findUnique.mockResolvedValue({ id: 'r1' } as never);
});

describe('acesso: só o admin supremo', () => {
  it('sem token 401; cliente 403; admin com perfil 403; nada é gravado', async () => {
    await request(app).get('/api/staff').expect(401);
    mockAccess(prisma(), 'c1', { isAdmin: false });
    await request(app).post('/api/staff').set('Authorization', tokenFor('c1')).send(body()).expect(403);
    mockAccess(prisma(), 'a1', { permissions: { clientes: 'edit', pedidos: 'edit' } });
    await request(app).post('/api/staff').set('Authorization', tokenFor('a1', true)).send(body()).expect(403);
    await request(app).delete('/api/staff/m1').set('Authorization', tokenFor('a1', true)).expect(403);
    expect(prisma().user.create).not.toHaveBeenCalled();
    expect(prisma().user.update).not.toHaveBeenCalled();
  });
});

describe('GET /api/staff', () => {
  it('lista a equipe sem nenhum dado de senha', async () => {
    prisma().user.findMany.mockResolvedValue([member()] as never);
    const res = await request(app).get('/api/staff').set(supreme).expect(200);
    expect(res.body[0]).toMatchObject({ email: 'marina@loja.com', role: { name: 'Atendimento' } });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    expect(prisma().user.findMany.mock.calls[0][0]!.where).toEqual({ isAdmin: true });
  });
});

describe('POST /api/staff', () => {
  it('cria o membro (201): e-mail em minúsculas, senha com bcrypt, resposta sem senha', async () => {
    prisma().user.create.mockResolvedValue(member() as never);
    const res = await request(app).post('/api/staff').set(supreme).send(body({ email: '  Marina@Loja.COM ' })).expect(201);
    const data = prisma().user.create.mock.calls[0][0].data as { email: string; passwordHash: string; isAdmin: boolean; roleId: string };
    expect(data.email).toBe('marina@loja.com');
    expect(data.isAdmin).toBe(true);
    expect(data.roleId).toBe('r1');
    // Conta da equipe não tem CPF: fica vazio e sem carimbo (a unicidade vale só para CPFs de verdade).
    const created = prisma().user.create.mock.calls[0][0].data as { cpf?: string; cpfHash?: string };
    expect(created.cpf ?? '').toBe('');
    expect(created.cpfHash).toBeUndefined();
    expect(data.passwordHash).not.toBe('senha-provisoria');
    expect(await bcrypt.compare('senha-provisoria', data.passwordHash)).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/senha|password/i);
  });

  it('senha curta, e-mail inválido ou nome vazio → 422 e nada é gravado', async () => {
    await request(app).post('/api/staff').set(supreme).send(body({ password: '1234567' })).expect(422);
    await request(app).post('/api/staff').set(supreme).send(body({ email: 'sem-arroba' })).expect(422);
    await request(app).post('/api/staff').set(supreme).send(body({ name: ' ' })).expect(422);
    expect(prisma().user.create).not.toHaveBeenCalled();
  });

  it('perfil inexistente → 422', async () => {
    prisma().role.findUnique.mockResolvedValue(null);
    await request(app).post('/api/staff').set(supreme).send(body({ roleId: 'nao-existe' })).expect(422);
    expect(prisma().user.create).not.toHaveBeenCalled();
  });

  it('e-mail já cadastrado (qualquer conta, mesmo com outra caixa) → 409', async () => {
    prisma().user.create.mockRejectedValue(p2002());
    const res = await request(app).post('/api/staff').set(supreme).send(body({ email: 'MARINA@loja.com' })).expect(409);
    expect(res.body.error).toMatch(/e-mail/i);
    expect((prisma().user.create.mock.calls[0][0].data as { email: string }).email).toBe('marina@loja.com');
  });
});

describe('PATCH /api/staff/:id', () => {
  beforeEach(() => targets({ m1: { id: 'm1', isAdmin: true, isSuperAdmin: false }, s1: { id: 's1', isAdmin: true, isSuperAdmin: true } }));

  it('troca perfil, nome e redefine a senha (rehasheada)', async () => {
    prisma().user.update.mockResolvedValue(member({ name: 'Nova' }) as never);
    await request(app).patch('/api/staff/m1').set(supreme).send({ name: 'Nova', roleId: 'r1', password: 'outra-senha-1' }).expect(200);
    const data = prisma().user.update.mock.calls[0][0].data as { name: string; roleId: string; passwordHash: string };
    expect(data).toMatchObject({ name: 'Nova', roleId: 'r1' });
    expect(await bcrypt.compare('outra-senha-1', data.passwordHash)).toBe(true);
  });

  it('corpo vazio, senha curta ou perfil inexistente → 422', async () => {
    await request(app).patch('/api/staff/m1').set(supreme).send({}).expect(422);
    await request(app).patch('/api/staff/m1').set(supreme).send({ password: 'curta' }).expect(422);
    prisma().role.findUnique.mockResolvedValue(null);
    await request(app).patch('/api/staff/m1').set(supreme).send({ roleId: 'x' }).expect(422);
    expect(prisma().user.update).not.toHaveBeenCalled();
  });

  it('o supremo não pode ser alterado, nem por ele mesmo → 403', async () => {
    await request(app).patch('/api/staff/s1').set(supreme).send({ roleId: 'r1' }).expect(403);
    expect(prisma().user.update).not.toHaveBeenCalled();
  });

  it('inexistente ou conta que não é da equipe → 404', async () => {
    targets({ c1: { id: 'c1', isAdmin: false, isSuperAdmin: false } });
    await request(app).patch('/api/staff/c1').set(supreme).send({ name: 'X' }).expect(404);
    await request(app).patch('/api/staff/zzz').set(supreme).send({ name: 'X' }).expect(404);
    expect(prisma().user.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/staff/:id', () => {
  beforeEach(() => targets({ m1: { id: 'm1', isAdmin: true, isSuperAdmin: false }, s1: { id: 's1', isAdmin: true, isSuperAdmin: true } }));

  it('tira o acesso à equipe (a conta continua) → 204', async () => {
    await request(app).delete('/api/staff/m1').set(supreme).expect(204);
    expect(prisma().user.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { isAdmin: false, roleId: null } });
    expect(prisma().user.delete).not.toHaveBeenCalled();
  });

  it('o supremo não pode ser removido (nem por ele mesmo) → 403', async () => {
    await request(app).delete('/api/staff/s1').set(supreme).expect(403);
    expect(prisma().user.update).not.toHaveBeenCalled();
  });

  it('inexistente ou cliente comum → 404', async () => {
    await request(app).delete('/api/staff/zzz').set(supreme).expect(404);
    expect(prisma().user.update).not.toHaveBeenCalled();
  });
});
