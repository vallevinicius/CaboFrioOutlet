import request from 'supertest';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { appWith, tokenFor } from '../test/helpers.js';
import { openCpf, sealCpf } from '../utils/cpf-vault.js';
import { Prisma } from '@prisma/client';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});

import { authRouter } from './auth.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/auth', authRouter);

const fullUser = (over: object = {}) => ({
  id: 'u1', name: 'Ana', email: 'ana@loja.com', passwordHash: '', cpf: '', phone: '', cep: '', street: '', number: '',
  complement: null, neighborhood: '', city: '', state: '', isAdmin: false, isSuperAdmin: false, roleId: null,
  createdAt: new Date('2026-11-16T12:00:00Z'), ...over,
});

/** `select` presente = consulta do loadAccess; sem `select` = leitura do usuário inteiro. */
function db(user: ReturnType<typeof fullUser>, role: { section: string; level: string }[] | null = null) {
  prisma().user.findUnique.mockImplementation(((args: { select?: object }) =>
    Promise.resolve(args.select ? { isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin, role: role && { permissions: role } } : user)) as never);
}

beforeEach(() => mockReset(prisma()));

describe('GET /api/auth/me', () => {
  it('cliente: sem permissões e sem hash de senha', async () => {
    db(fullUser({ cpf: 'equipe-abc123' }));
    const res = await request(app).get('/api/auth/me').set('Authorization', tokenFor('u1')).expect(200);
    expect(res.body.user).toMatchObject({ isAdmin: false, isSuperAdmin: false, permissions: {} });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user.cpf).toBe('');
  });

  it('membro da equipe: permissões do perfil (view/edit)', async () => {
    db(fullUser({ isAdmin: true }), [{ section: 'produtos', level: 'EDIT' }, { section: 'pedidos', level: 'VIEW' }]);
    const res = await request(app).get('/api/auth/me').set('Authorization', tokenFor('u1', true)).expect(200);
    expect(res.body.user).toMatchObject({ isAdmin: true, isSuperAdmin: false, permissions: { produtos: 'edit', pedidos: 'view' } });
  });

  it('admin supremo: editar em todas as telas', async () => {
    db(fullUser({ isAdmin: true, isSuperAdmin: true }));
    const res = await request(app).get('/api/auth/me').set('Authorization', tokenFor('u1', true)).expect(200);
    expect(res.body.user.isSuperAdmin).toBe(true);
    expect(Object.keys(res.body.user.permissions)).toHaveLength(8);
    expect(Object.values(res.body.user.permissions).every((l) => l === 'edit')).toBe(true);
  });

  it('sem token → 401', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });
});

describe('POST /api/auth/login', () => {
  it('membro da equipe recebe as permissões no login', async () => {
    const passwordHash = await bcrypt.hash('senha-boa-123', 4);
    db(fullUser({ isAdmin: true, passwordHash }), [{ section: 'estoque', level: 'EDIT' }]);
    const res = await request(app).post('/api/auth/login').send({ email: 'ANA@loja.com', password: 'senha-boa-123' }).expect(200);
    expect(res.body.user.permissions).toEqual({ estoque: 'edit' });
    expect(res.body.token).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain(passwordHash);
  });
});

describe('PUT /api/auth/me', () => {
  it('ao salvar o perfil, a resposta mantém as permissões (o front não pode perdê-las)', async () => {
    const user = fullUser({ isAdmin: true });
    db(user, [{ section: 'pedidos', level: 'VIEW' }]);
    prisma().user.update.mockResolvedValue(user as never);
    const res = await request(app).put('/api/auth/me').set('Authorization', tokenFor('u1', true)).send({ name: 'Ana Maria', email: 'ana@loja.com', phone: '22999998888', cep: '28905000', street: 'Rua A', number: '10', neighborhood: 'Centro', city: 'Cabo Frio', state: 'RJ' }).expect(200);
    expect(res.body.user.permissions).toEqual({ pedidos: 'view' });
  });
});

describe('CPF cifrado no banco', () => {
  it('/me devolve o CPF aberto (só números), nunca o texto cifrado', async () => {
    db(fullUser({ cpf: sealCpf('529.982.247-25').cpf }));
    const res = await request(app).get('/api/auth/me').set('Authorization', tokenFor('u1')).expect(200);
    expect(res.body.user.cpf).toBe('52998224725');
    expect(JSON.stringify(res.body)).not.toContain('enc:v1');
  });

  const registro = {
    name: 'Maria', email: 'Maria@Exemplo.com', password: 'segredo123', cpf: '529.982.247-25', phone: '(22) 99999-1234',
    cep: '28905-000', street: 'Rua A', number: '10', neighborhood: 'Centro', city: 'Cabo Frio', state: 'rj',
  };

  it('cadastro grava o CPF cifrado com o carimbo de unicidade, e nunca em texto puro', async () => {
    prisma().user.create.mockImplementation((async (args: { data: Record<string, unknown> }) => fullUser(args.data)) as never);
    const res = await request(app).post('/api/auth/register').send(registro).expect(201);
    const data = prisma().user.create.mock.calls[0][0].data as { cpf: string; cpfHash: string };
    expect(data.cpf.startsWith('enc:v1:')).toBe(true);
    expect(data.cpf).not.toContain('52998224725');
    expect(openCpf(data.cpf)).toBe('52998224725');
    expect(data.cpfHash).toBe(sealCpf('52998224725').cpfHash);
    expect(res.body.user.cpf).toBe('52998224725');
  });

  it('CPF já cadastrado (carimbo repetido) → 409 com a mensagem do CPF', async () => {
    prisma().user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '6', meta: { target: ['cpfHash'] } }));
    const res = await request(app).post('/api/auth/register').send(registro).expect(409);
    expect(res.body.error).toMatch(/CPF/);
  });
});
