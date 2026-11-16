import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { mockAccess, tokenFor } from '../test/helpers.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});

import { requireAnyPermission, requirePermission, requireSuperAdmin } from './permissions.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;

const app = express();
app.get('/ver-pedidos', requirePermission('pedidos', 'view'), (_req, res) => res.json({ ok: true }));
app.post('/editar-pedidos', requirePermission('pedidos', 'edit'), (_req, res) => res.json({ ok: true }));
app.put(
  '/estoque',
  requireAnyPermission(['estoque', 'edit'], ['produtos', 'edit']),
  (_req, res) => res.json({ ok: true }),
);
app.get('/equipe', requireSuperAdmin, (_req, res) => res.json({ ok: true }));

beforeEach(() => mockReset(prisma()));

describe('autenticação', () => {
  it('sem token → 401', async () => {
    await request(app).get('/ver-pedidos').expect(401);
  });
  it('token inválido → 401', async () => {
    await request(app).get('/ver-pedidos').set('Authorization', 'Bearer lixo').expect(401);
  });
  it('token de usuário que não existe mais → 401', async () => {
    mockAccess(prisma(), 'u1', null);
    await request(app).get('/ver-pedidos').set('Authorization', tokenFor('u1', true)).expect(401);
  });
});

describe('requirePermission', () => {
  it('cliente comum → 403', async () => {
    mockAccess(prisma(), 'c1', { isAdmin: false });
    await request(app).get('/ver-pedidos').set('Authorization', tokenFor('c1')).expect(403);
  });

  it('o banco manda, não o token: JWT com isAdmin=true mas banco sem acesso → 403', async () => {
    mockAccess(prisma(), 'u1', { isAdmin: false, permissions: { pedidos: 'edit' } });
    await request(app).get('/ver-pedidos').set('Authorization', tokenFor('u1', true)).expect(403);
  });

  it('perfil sem a tela → 403', async () => {
    mockAccess(prisma(), 'u1', { permissions: { produtos: 'edit' } });
    await request(app).get('/ver-pedidos').set('Authorization', tokenFor('u1', true)).expect(403);
  });

  it('só ver: lê (200) mas não escreve (403)', async () => {
    mockAccess(prisma(), 'u1', { permissions: { pedidos: 'view' } });
    await request(app).get('/ver-pedidos').set('Authorization', tokenFor('u1', true)).expect(200);
    await request(app).post('/editar-pedidos').set('Authorization', tokenFor('u1', true)).expect(403);
  });

  it('editar permite ler e escrever', async () => {
    mockAccess(prisma(), 'u1', { permissions: { pedidos: 'edit' } });
    await request(app).get('/ver-pedidos').set('Authorization', tokenFor('u1', true)).expect(200);
    await request(app).post('/editar-pedidos').set('Authorization', tokenFor('u1', true)).expect(200);
  });

  it('mudança de perfil vale na requisição seguinte, sem cache', async () => {
    const token = tokenFor('u1', true);
    mockAccess(prisma(), 'u1', { permissions: { pedidos: 'edit' } });
    await request(app).post('/editar-pedidos').set('Authorization', token).expect(200);
    mockAccess(prisma(), 'u1', { permissions: { pedidos: 'view' } });
    await request(app).post('/editar-pedidos').set('Authorization', token).expect(403);
    mockAccess(prisma(), 'u1', { isAdmin: false });
    await request(app).get('/ver-pedidos').set('Authorization', token).expect(403);
  });

  it('supremo passa em qualquer tela', async () => {
    mockAccess(prisma(), 's1', { isSuperAdmin: true });
    await request(app).post('/editar-pedidos').set('Authorization', tokenFor('s1', true)).expect(200);
  });
});

describe('requireAnyPermission', () => {
  it('basta uma das permissões', async () => {
    mockAccess(prisma(), 'u1', { permissions: { produtos: 'edit' } });
    await request(app).put('/estoque').set('Authorization', tokenFor('u1', true)).expect(200);
    mockAccess(prisma(), 'u2', { permissions: { estoque: 'edit' } });
    await request(app).put('/estoque').set('Authorization', tokenFor('u2', true)).expect(200);
  });
  it('com só ver nas duas → 403', async () => {
    mockAccess(prisma(), 'u1', { permissions: { produtos: 'view', estoque: 'view' } });
    await request(app).put('/estoque').set('Authorization', tokenFor('u1', true)).expect(403);
  });
});

describe('requireSuperAdmin', () => {
  it('supremo → 200', async () => {
    mockAccess(prisma(), 's1', { isSuperAdmin: true });
    await request(app).get('/equipe').set('Authorization', tokenFor('s1', true)).expect(200);
  });
  it('admin com perfil "Administrador" (não supremo) → 403', async () => {
    mockAccess(prisma(), 'a1', { permissions: { pedidos: 'edit', produtos: 'edit' } });
    await request(app).get('/equipe').set('Authorization', tokenFor('a1', true)).expect(403);
  });
  it('cliente comum → 403', async () => {
    mockAccess(prisma(), 'c1', { isAdmin: false });
    await request(app).get('/equipe').set('Authorization', tokenFor('c1')).expect(403);
  });
});
