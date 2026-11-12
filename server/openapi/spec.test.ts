import express, { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { tokenFor } from '../test/helpers';

vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return { prisma: mockDeep() };
});
vi.mock('../services/mercadopago', () => ({ MP_PUBLIC_KEY: 'pk', mpFetch: vi.fn() }));

import { authRouter } from '../routes/auth';
import { checkoutRouter } from '../routes/checkout';
import { favoritesRouter } from '../routes/favorites';
import { heroSlidesRouter } from '../routes/hero-slides';
import { ordersRouter } from '../routes/orders';
import { productsRouter } from '../routes/products';
import { reportsRouter } from '../routes/reports';
import { reviewsRouter } from '../routes/reviews';
import { settingsRouter } from '../routes/settings';
import { shippingRouter } from '../routes/shipping';
import { uploadRouter } from '../routes/upload';
import { usersRouter } from '../routes/users';
import { wholesaleRouter } from '../routes/wholesale';
import { seoRouter } from '../seo/routes';
import { mountApiDocs } from './docs';
import { buildOpenApiDocument } from './spec';

const MOUNTS: [string, Router][] = [
  ['/api/auth', authRouter],
  ['/api/products', productsRouter],
  ['/api/orders', ordersRouter],
  ['/api/settings', settingsRouter],
  ['/api/upload', uploadRouter],
  ['/api/users', usersRouter],
  ['/api/hero-slides', heroSlidesRouter],
  ['/api/checkout', checkoutRouter],
  ['/api/shipping', shippingRouter],
  ['/api/reviews', reviewsRouter],
  ['/api/favorites', favoritesRouter],
  ['/api/reports', reportsRouter],
  ['/api/wholesale', wholesaleRouter],
  ['', seoRouter],
];

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
}

/** Lista "METODO /caminho/{param}" de todas as rotas reais montadas no Express. */
function realRoutes(): Set<string> {
  const out = new Set<string>(['GET /api/health']); // montada direto no index.ts
  for (const [mount, router] of MOUNTS) {
    for (const layer of (router as unknown as { stack: Layer[] }).stack) {
      if (!layer.route) continue;
      const full = (mount + (layer.route.path === '/' ? '' : layer.route.path)).replace(/:(\w+)/g, '{$1}') || '/';
      for (const method of Object.keys(layer.route.methods)) out.add(`${method.toUpperCase()} ${full}`);
    }
  }
  return out;
}

const doc = buildOpenApiDocument();

function documentedRoutes(): Set<string> {
  const out = new Set<string>();
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of Object.keys(item as object)) out.add(`${method.toUpperCase()} ${path}`);
  }
  return out;
}

describe('OpenAPI: cobertura', () => {
  it('o inventário de rotas reais não está vazio (guarda contra falso positivo)', () => {
    expect(realRoutes().size).toBeGreaterThanOrEqual(38);
    expect(realRoutes().has('POST /api/auth/login')).toBe(true);
    expect(realRoutes().has('PUT /api/products/{id}/stock')).toBe(true);
  });

  it('toda rota do Express está documentada', () => {
    const missing = [...realRoutes()].filter((r) => !documentedRoutes().has(r));
    expect(missing).toEqual([]);
  });

  it('nada documentado que não exista (documentação não pode inventar rota)', () => {
    const extra = [...documentedRoutes()].filter((r) => !realRoutes().has(r));
    expect(extra).toEqual([]);
  });
});

describe('OpenAPI: qualidade do documento', () => {
  const ops = Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
    Object.entries(item as Record<string, { security?: unknown[]; responses: Record<string, unknown>; summary?: string; tags?: string[] }>).map(
      ([method, op]) => ({ key: `${method.toUpperCase()} ${path}`, path, op }),
    ),
  );

  it('toda operação tem resumo, tag e resposta de sucesso', () => {
    for (const { key, op } of ops) {
      expect(op.summary, key).toBeTruthy();
      expect(op.tags?.length, key).toBeGreaterThan(0);
      expect(Object.keys(op.responses).some((c) => c.startsWith('2')), key).toBe(true);
    }
  });

  it('rotas de admin e de usuário logado declaram bearerAuth e as respostas 401/403', () => {
    const protectedKeys = [
      'GET /api/orders',
      'GET /api/orders/mine',
      'POST /api/products',
      'PUT /api/settings',
      'GET /api/reports/overview',
      'GET /api/favorites',
      'POST /api/upload',
      'GET /api/users',
      'GET /api/wholesale/quotes',
    ];
    for (const key of protectedKeys) {
      const found = ops.find((o) => o.key === key);
      expect(found, key).toBeDefined();
      expect(found!.op.security, key).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(found!.op.responses), key).toContain('401');
    }
    for (const key of ['GET /api/orders', 'POST /api/products', 'PUT /api/settings', 'GET /api/reports/overview']) {
      expect(Object.keys(ops.find((o) => o.key === key)!.op.responses), key).toContain('403');
    }
  });

  it('rotas públicas não declaram segurança', () => {
    for (const key of ['GET /api/products', 'GET /api/settings', 'POST /api/auth/login', 'GET /api/reviews']) {
      expect(ops.find((o) => o.key === key)!.op.security, key).toBeUndefined();
    }
  });

  it('nenhum schema expõe campos sensíveis em respostas', () => {
    const schemas = (doc.components?.schemas ?? {}) as Record<string, { properties?: Record<string, unknown> }>;
    const forbidden = ['passwordHash', 'melhorEnvioToken_response'];
    for (const [name, schema] of Object.entries(schemas)) {
      const props = Object.keys(schema.properties ?? {});
      expect(props, name).not.toContain(forbidden[0]);
    }
    // o token da Melhor Envio só existe na ENTRADA; a resposta traz apenas hasMelhorEnvioToken
    const settings = schemas['Configuracoes'].properties ?? {};
    expect(Object.keys(settings)).toContain('hasMelhorEnvioToken');
    expect(Object.keys(settings)).not.toContain('melhorEnvioToken');
  });

  it('o pedido enviado pelo cliente não aceita preços (o servidor usa o catálogo)', () => {
    const schemas = doc.components?.schemas as Record<string, { properties: Record<string, { items?: { properties?: Record<string, unknown> } }> }>;
    const itemProps = Object.keys(schemas['PedidoEntrada'].properties['items'].items?.properties ?? {});
    expect(itemProps.sort()).toEqual(['productId', 'quantity', 'size']);
  });
});

describe('OpenAPI: atacado', () => {
  const schemas = doc.components?.schemas as Record<string, { properties: Record<string, unknown> }>;

  it('o pedido aceita só a marca "wholesale": percentual de desconto nunca vem do cliente', () => {
    const props = Object.keys(schemas['PedidoEntrada'].properties);
    expect(props).toContain('wholesale');
    expect(props).not.toContain('wholesaleDiscountPercent');
    expect(props).not.toContain('discountPercent');
  });

  it('o orçamento recebe só produto/tamanho/quantidade (preço e total são calculados no servidor)', () => {
    const items = schemas['AtacadoPedidoEntrada'].properties['items'] as { items: { properties: Record<string, unknown> } };
    expect(Object.keys(items.items.properties).sort()).toEqual(['productId', 'quantity', 'size']);
    expect(Object.keys(schemas['AtacadoPedidoEntrada'].properties)).not.toContain('estimatedTotal');
  });

  it('as faixas de desconto são documentadas na leitura e na escrita das configurações', () => {
    expect(Object.keys(schemas['Configuracoes'].properties)).toContain('wholesaleTiers');
    expect(Object.keys(schemas['ConfiguracoesEntrada'].properties)).toContain('wholesaleTiers');
  });
});

describe('Swagger UI: exposição', () => {
  it('fora de produção serve a interface e o JSON', async () => {
    const app = express();
    mountApiDocs(app, 'development');
    await request(app).get('/api/docs.json').expect(200);
    const ui = await request(app).get('/api/docs/').expect(200);
    expect(ui.text).toContain('swagger');
  });

  it('em produção não há interface e o JSON só abre para administrador', async () => {
    const app = express();
    mountApiDocs(app, 'production');
    await request(app).get('/api/docs/').expect(404);
    await request(app).get('/api/docs.json').expect(401);
    await request(app).get('/api/docs.json').set('Authorization', tokenFor('cliente', false)).expect(403);
    const res = await request(app).get('/api/docs.json').set('Authorization', tokenFor('admin', true)).expect(200);
    expect(res.body.openapi).toBe('3.1.0');
  });
});
