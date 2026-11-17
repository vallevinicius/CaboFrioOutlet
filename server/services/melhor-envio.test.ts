import { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});
const getAccessToken = vi.hoisted(() => vi.fn());
const refreshAccessToken = vi.hoisted(() => vi.fn());
vi.mock('./melhor-envio-auth', () => ({ getAccessToken, refreshAccessToken }));

import { calculateShippingOptions, combinePackages, type ShippingPackageInput } from './melhor-envio.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const pkg = (over: Partial<ShippingPackageInput> = {}): ShippingPackageInput => ({
  productId: 'p1', weightKg: 0.3, heightCm: 4, widthCm: 25, lengthCm: 30, quantity: 1, unitPrice: 100, ...over,
});

describe('combinePackages (embalagem única)', () => {
  it('uma peça: mantém as medidas e o valor', () => {
    expect(combinePackages([pkg()])).toEqual({ weightKg: 0.3, heightCm: 4, widthCm: 25, lengthCm: 30, insuranceValue: 100 });
  });
  it('várias peças empilhadas: soma peso, altura e valor; largura e comprimento ficam com o maior', () => {
    const result = combinePackages([
      pkg({ quantity: 3 }), // 3 camisas
      pkg({ productId: 'p2', weightKg: 0.7, heightCm: 6, widthCm: 28, lengthCm: 35, quantity: 1, unitPrice: 200 }), // 1 calça
    ]);
    expect(result.weightKg).toBeCloseTo(0.3 * 3 + 0.7, 5);
    expect(result.heightCm).toBe(4 * 3 + 6);
    expect(result.widthCm).toBe(28);
    expect(result.lengthCm).toBe(35);
    expect(result.insuranceValue).toBe(100 * 3 + 200);
  });
  it('lista vazia não quebra (caixa zerada)', () => {
    expect(combinePackages([])).toEqual({ weightKg: 0, heightCm: 0, widthCm: 0, lengthCm: 0, insuranceValue: 0 });
  });
});

describe('calculateShippingOptions', () => {
  const fetchMock = vi.fn();
  const settings = (over: object = {}) => ({ originCep: '28905-000', melhorEnvioSandbox: false, ...over });
  const apiOk = (items: object[]) => ({ ok: true, status: 200, json: async () => items, text: async () => '' });

  beforeEach(() => {
    mockReset(prisma());
    fetchMock.mockReset();
    getAccessToken.mockReset();
    refreshAccessToken.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    prisma().settings.findUnique.mockResolvedValue(settings() as never);
    getAccessToken.mockResolvedValue('token-de-acesso');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sem CEP de origem ou sem conexão com a Melhor Envio: null e nenhuma chamada de rede (cai no frete fixo)', async () => {
    prisma().settings.findUnique.mockResolvedValue(settings({ originCep: '' }) as never);
    expect(await calculateShippingOptions('01001000', [pkg()])).toBeNull();
    prisma().settings.findUnique.mockResolvedValue(settings() as never);
    getAccessToken.mockResolvedValue(null);
    expect(await calculateShippingOptions('01001000', [pkg()])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('manda UMA embalagem com as medidas combinadas (respeitando o mínimo dos Correios), o token e o User-Agent', async () => {
    fetchMock.mockResolvedValue(apiOk([]));
    await calculateShippingOptions('01001-000', [pkg({ quantity: 2 }), pkg({ productId: 'p2', heightCm: 1, widthCm: 5, lengthCm: 8, weightKg: 0.1 })]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://melhorenvio.com.br/api/v2/me/shipment/calculate');
    expect(init.headers.Authorization).toBe('Bearer token-de-acesso');
    expect(init.headers['User-Agent']).toMatch(/Cabo Frio Outlet \(.+@.+\)/);
    const body = JSON.parse(init.body);
    expect(body.from.postal_code).toBe('28905000');
    expect(body.to.postal_code).toBe('01001000');
    expect(body.products).toHaveLength(1);
    expect(body.products[0]).toMatchObject({ quantity: 1, weight: 0.7, height: 9, width: 25, length: 30, insurance_value: 300 });
  });

  it('medidas abaixo do mínimo aceito pelos Correios são elevadas ao mínimo (11 de largura, 2 de altura, 16 de comprimento)', async () => {
    fetchMock.mockResolvedValue(apiOk([]));
    await calculateShippingOptions('01001000', [pkg({ heightCm: 0.5, widthCm: 3, lengthCm: 4 })]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).products[0]).toMatchObject({ height: 2, width: 11, length: 16 });
  });

  it('modo sandbox usa o endereço de testes', async () => {
    prisma().settings.findUnique.mockResolvedValue(settings({ melhorEnvioSandbox: true }) as never);
    fetchMock.mockResolvedValue(apiOk([]));
    await calculateShippingOptions('01001000', [pkg()]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate');
  });

  it('devolve as opções válidas, mais baratas primeiro, sem as que vieram com erro', async () => {
    fetchMock.mockResolvedValue(apiOk([
      { id: 2, name: 'SEDEX', price: '45.90', delivery_time: 2, company: { name: 'Correios' } },
      { id: 1, name: 'PAC', price: '22.50', delivery_time: 6, company: { name: 'Correios' } },
      { id: 3, name: 'Package', error: 'Serviço indisponível', company: { name: 'Jadlog' } },
    ]));
    const options = await calculateShippingOptions('01001000', [pkg()]);
    expect(options).toEqual([
      { id: 1, name: 'Correios PAC', price: 22.5, deliveryTime: 6, company: 'Correios' },
      { id: 2, name: 'Correios SEDEX', price: 45.9, deliveryTime: 2, company: 'Correios' },
    ]);
  });

  it('token recusado (401): renova uma vez e repete a consulta com o token novo', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}), text: async () => 'Unauthenticated' })
      .mockResolvedValueOnce(apiOk([{ id: 1, name: 'PAC', price: '20.00', company: { name: 'Correios' } }]));
    refreshAccessToken.mockResolvedValue('token-novo');
    const options = await calculateShippingOptions('01001000', [pkg()]);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-novo');
    expect(options).toHaveLength(1);
  });

  it('401 e a renovação falha: null (frete fixo), sem insistir em loop', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}), text: async () => 'Unauthenticated' });
    refreshAccessToken.mockResolvedValue(null);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await calculateShippingOptions('01001000', [pkg()])).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('erro da API (500) ou resposta que não é lista: null', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}), text: async () => 'erro' });
    expect(await calculateShippingOptions('01001000', [pkg()])).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ message: 'x' }), text: async () => '' });
    expect(await calculateShippingOptions('01001000', [pkg()])).toBeNull();
  });
});
