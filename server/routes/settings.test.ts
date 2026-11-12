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

import { settingsRouter } from './settings';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/settings', settingsRouter);

const row = {
  id: 1,
  storeName: 'Cabo Frio Outlet',
  freeShippingThreshold: 299,
  shippingFee: 19.9,
  originCep: '',
  melhorEnvioToken: 'SEGREDO',
  melhorEnvioSandbox: true,
  announcementMessages: '[]',
  brands: '[]',
  whatsapp: '',
  contactEmail: '',
  openingHours: null,
  googlePlaceId: '',
  tickerMessages: null,
  storyTitle: '',
  storyBody: null,
  gaMeasurementId: '',
  metaPixelId: '',
  wholesaleMinPieces: 10,
  wholesaleNotes: null,
  wholesaleTiers: null,
};

beforeEach(() => {
  mockReset(prisma());
  prisma().settings.upsert.mockResolvedValue(row as never);
});

describe('GET /api/settings (público)', () => {
  it('devolve padrões da home e nunca vaza o token da Melhor Envio', async () => {
    const res = await request(app).get('/api/settings').expect(200);
    expect(res.body.hasMelhorEnvioToken).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('SEGREDO');
    expect(res.body.tickerMessages).toContain('Multimarcas');
    expect(res.body.storyTitle).toBe('10 anos vestindo Cabo Frio');
    expect(res.body.openingHours).toHaveLength(2);
  });
});

describe('PUT /api/settings: acesso', () => {
  it('sem token 401; cliente comum 403; nada é gravado', async () => {
    await request(app).put('/api/settings').send({ storeName: 'X' }).expect(401);
    await request(app).put('/api/settings').set('Authorization', tokenFor('cliente', false)).send({ storeName: 'X' }).expect(403);
    expect(prisma().settings.upsert).not.toHaveBeenCalled();
  });
});

describe('PUT /api/settings: validação (admin)', () => {
  const admin = { Authorization: tokenFor('admin', true) };
  const put = (body: object) => request(app).put('/api/settings').set(admin).send(body);

  it.each([
    ['whatsapp', { whatsapp: '123' }],
    ['e-mail', { contactEmail: 'sem-arroba' }],
    ['horários', { openingHours: [{ label: 'Dom', hours: '' }] }],
    ['place id', { googlePlaceId: 'a/b' }],
    ['faixa', { tickerMessages: ['x'.repeat(61)] }],
    ['título', { storyTitle: 'x'.repeat(81) }],
    ['texto', { storyBody: 'x'.repeat(1201) }],
    ['GA4', { gaMeasurementId: "G-ABCD');alert(1)" }],
    ['pixel', { metaPixelId: 'abc' }],
    ['pedido mínimo zero', { wholesaleMinPieces: 0 }],
    ['pedido mínimo quebrado', { wholesaleMinPieces: 2.5 }],
    ['condições longas', { wholesaleNotes: 'x'.repeat(1501) }],
    ['faixa com desconto acima de 90', { wholesaleTiers: [{ minPieces: 10, discountPercent: 95 }] }],
    ['faixas com desconto que não cresce', { wholesaleTiers: [{ minPieces: 10, discountPercent: 10 }, { minPieces: 20, discountPercent: 5 }] }],
    ['faixas com quantidade repetida', { wholesaleTiers: [{ minPieces: 10, discountPercent: 5 }, { minPieces: 10, discountPercent: 8 }] }],
    ['faixas que não são lista', { wholesaleTiers: 'x' }],
  ])('rejeita %s inválido com 400 e não grava', async (_nome, body) => {
    await put(body).expect(400);
    expect(prisma().settings.upsert).not.toHaveBeenCalled();
  });

  it('normaliza WhatsApp, e-mail e IDs antes de gravar', async () => {
    await put({ whatsapp: '(22) 99999-1234', contactEmail: ' Contato@Loja.com ', gaMeasurementId: 'g-ab12cd34', metaPixelId: ' 12345678901 ' }).expect(200);
    const update = prisma().settings.upsert.mock.calls[0][0].update as Record<string, unknown>;
    expect(update).toMatchObject({
      whatsapp: '5522999991234',
      contactEmail: 'contato@loja.com',
      gaMeasurementId: 'G-AB12CD34',
      metaPixelId: '12345678901',
    });
  });

  it('grava o pedido mínimo e apagar as condições volta ao padrão (nulo)', async () => {
    await put({ wholesaleMinPieces: 12, wholesaleNotes: '  ' }).expect(200);
    expect(prisma().settings.upsert.mock.calls[0][0].update).toMatchObject({ wholesaleMinPieces: 12, wholesaleNotes: null });
  });

  it('grava as faixas ordenadas e GET devolve as faixas padrão quando nada foi salvo', async () => {
    await put({ wholesaleTiers: [{ minPieces: 30, discountPercent: 12 }, { minPieces: 10, discountPercent: 4 }] }).expect(200);
    expect(JSON.parse(prisma().settings.upsert.mock.calls[0][0].update.wholesaleTiers as string)).toEqual([
      { minPieces: 10, discountPercent: 4 },
      { minPieces: 30, discountPercent: 12 },
    ]);
    const res = await request(app).get('/api/settings').expect(200);
    expect(res.body.wholesaleTiers).toEqual([
      { minPieces: 10, discountPercent: 5 },
      { minPieces: 20, discountPercent: 10 },
      { minPieces: 50, discountPercent: 15 },
    ]);
  });

  it('GET devolve pedido mínimo e as condições padrão do atacado', async () => {
    const res = await request(app).get('/api/settings').expect(200);
    expect(res.body.wholesaleMinPieces).toBe(10);
    expect(res.body.wholesaleNotes.split('\n')).toHaveLength(3);
  });

  it('apagar o texto da história grava nulo (volta ao padrão)', async () => {
    await put({ storyBody: '  ' }).expect(200);
    expect(prisma().settings.upsert.mock.calls[0][0].update).toMatchObject({ storyBody: null });
  });
});
