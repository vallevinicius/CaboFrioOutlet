import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import type { Router } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { appWith, mockAccess, tokenFor, type FakeAccess } from '../test/helpers.js';
import type { Level, Section } from '../services/access.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});
vi.mock('../services/melhor-envio', () => ({ calculateShippingOptions: vi.fn().mockResolvedValue(null) }));
vi.mock('../services/stock', () => ({ expireStaleOrders: vi.fn(), restoreStockForOrder: vi.fn() }));

import { productsRouter } from './products.js';
import { heroSlidesRouter } from './hero-slides.js';
import { settingsRouter } from './settings.js';
import { uploadRouter } from './upload.js';
import { ordersRouter } from './orders.js';
import { wholesaleRouter } from './wholesale.js';
import { reportsRouter } from './reports.js';
import { usersRouter } from './users.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;

type Need = [Section, Level];
interface Case {
  name: string;
  router: Router;
  mount: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  url: string;
  /** Basta uma das permissões. */
  any: Need[];
}

const cases: Case[] = [
  { name: 'criar produto', router: productsRouter, mount: '/api/products', method: 'post', url: '/api/products', any: [['produtos', 'edit']] },
  { name: 'editar produto', router: productsRouter, mount: '/api/products', method: 'put', url: '/api/products/p1', any: [['produtos', 'edit']] },
  { name: 'apagar produto', router: productsRouter, mount: '/api/products', method: 'delete', url: '/api/products/p1', any: [['produtos', 'edit']] },
  { name: 'ajustar estoque', router: productsRouter, mount: '/api/products', method: 'put', url: '/api/products/p1/stock', any: [['estoque', 'edit'], ['produtos', 'edit']] },
  { name: 'criar banner', router: heroSlidesRouter, mount: '/api/hero-slides', method: 'post', url: '/api/hero-slides', any: [['banners', 'edit']] },
  { name: 'editar banner', router: heroSlidesRouter, mount: '/api/hero-slides', method: 'put', url: '/api/hero-slides/h1', any: [['banners', 'edit']] },
  { name: 'mover banner', router: heroSlidesRouter, mount: '/api/hero-slides', method: 'patch', url: '/api/hero-slides/h1/move', any: [['banners', 'edit']] },
  { name: 'apagar banner', router: heroSlidesRouter, mount: '/api/hero-slides', method: 'delete', url: '/api/hero-slides/h1', any: [['banners', 'edit']] },
  { name: 'salvar configurações', router: settingsRouter, mount: '/api/settings', method: 'put', url: '/api/settings', any: [['configuracoes', 'edit']] },
  { name: 'enviar imagem', router: uploadRouter, mount: '/api/upload', method: 'post', url: '/api/upload', any: [['produtos', 'edit'], ['banners', 'edit'], ['configuracoes', 'edit']] },
  { name: 'listar pedidos', router: ordersRouter, mount: '/api/orders', method: 'get', url: '/api/orders', any: [['pedidos', 'view']] },
  { name: 'mudar status do pedido', router: ordersRouter, mount: '/api/orders', method: 'patch', url: '/api/orders/o1/status', any: [['pedidos', 'edit']] },
  { name: 'listar orçamentos de atacado', router: wholesaleRouter, mount: '/api/wholesale', method: 'get', url: '/api/wholesale/quotes', any: [['atacado', 'view']] },
  { name: 'tratar orçamento de atacado', router: wholesaleRouter, mount: '/api/wholesale', method: 'patch', url: '/api/wholesale/quotes/q1', any: [['atacado', 'edit']] },
  { name: 'ver visão geral', router: reportsRouter, mount: '/api/reports', method: 'get', url: '/api/reports/overview', any: [['inicio', 'view']] },
  { name: 'listar clientes', router: usersRouter, mount: '/api/users', method: 'get', url: '/api/users', any: [['clientes', 'view']] },
];

const call = (c: Case, token?: string) => {
  const req = request(appWith(c.mount, c.router))[c.method](c.url);
  if (token) req.set('Authorization', token);
  return req.send({});
};

const asStaff = (access: FakeAccess) => {
  mockAccess(prisma(), 'staff', access);
  return tokenFor('staff', true);
};

beforeEach(() => mockReset(prisma()));

describe.each(cases)('$name', (c) => {
  it('sem token → 401', async () => {
    await call(c).expect(401);
  });

  it('cliente comum → 403', async () => {
    mockAccess(prisma(), 'cliente', { isAdmin: false });
    await call(c, tokenFor('cliente')).expect(403);
  });

  it('perfil sem nenhuma tela → 403', async () => {
    await call(c, asStaff({ permissions: {} })).expect(403);
  });

  it('só ver nas telas da rota: bloqueia a escrita e não grava nada', async () => {
    const [[, level]] = c.any;
    if (level === 'view') return; // rota de leitura: "ver" é o suficiente
    const viewOnly = Object.fromEntries(c.any.map(([s]) => [s, 'view'])) as FakeAccess['permissions'];
    await call(c, asStaff({ permissions: viewOnly })).expect(403);
    expect(prisma().product.create).not.toHaveBeenCalled();
    expect(prisma().product.update).not.toHaveBeenCalled();
    expect(prisma().product.delete).not.toHaveBeenCalled();
    expect(prisma().order.update).not.toHaveBeenCalled();
    expect(prisma().settings.upsert).not.toHaveBeenCalled();
  });

  it.each(c.any)('com %s:%s a requisição passa pela autorização', async (section, level) => {
    const res = await call(c, asStaff({ permissions: { [section]: level } }));
    expect([401, 403]).not.toContain(res.status);
  });

  it('o supremo passa', async () => {
    const res = await call(c, asStaff({ isSuperAdmin: true }));
    expect([401, 403]).not.toContain(res.status);
  });
});
