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

  it('apagar o texto da história grava nulo (volta ao padrão)', async () => {
    await put({ storyBody: '  ' }).expect(200);
    expect(prisma().settings.upsert.mock.calls[0][0].update).toMatchObject({ storyBody: null });
  });
});
