import { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});

import {
  buildAuthorizeUrl,
  connectWithCode,
  consumeState,
  createState,
  disconnect,
  getAccessToken,
  getConnectionStatus,
  redirectUri,
  refreshAccessToken,
} from './melhor-envio-auth.js';
import { decryptField, encryptField } from '../utils/crypto-field.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const DAY = 24 * 60 * 60 * 1000;
const tokenReply = (over: object = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({ token_type: 'Bearer', expires_in: 2592000, access_token: 'acesso-novo', refresh_token: 'renovacao-nova', ...over }),
  text: async () => '',
});
const stored = (over: object = {}) => ({
  originCep: '28905000',
  melhorEnvioSandbox: false,
  melhorEnvioToken: encryptField('acesso-atual'),
  melhorEnvioRefreshToken: encryptField('renovacao-atual'),
  melhorEnvioTokenExpiresAt: new Date(Date.now() + 20 * DAY),
  ...over,
});
const savedData = () => prisma().settings.upsert.mock.calls.at(-1)![0].update as Record<string, unknown>;

const fetchMock = vi.fn();

beforeEach(() => {
  mockReset(prisma());
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.MELHOR_ENVIO_CLIENT_ID = '1234';
  process.env.MELHOR_ENVIO_CLIENT_SECRET = 'segredo-do-app';
  process.env.SITE_URL = 'https://loja.exemplo.com.br/';
  prisma().settings.findUnique.mockResolvedValue(stored() as never);
  prisma().settings.upsert.mockResolvedValue({} as never);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('endereço de retorno e link de autorização', () => {
  it('o retorno é fixo, sem barra dupla, e bate com o cadastrado no app da Melhor Envio', () => {
    expect(redirectUri()).toBe('https://loja.exemplo.com.br/api/shipping/melhor-envio/callback');
  });

  it.each([[undefined], [''], ['   ']])('sem SITE_URL (%s) não existe endereço de retorno: nada de cair em localhost', (value) => {
    if (value === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = value;
    expect(redirectUri()).toBeNull();
  });

  it('sem SITE_URL o link de autorização não é montado (seria recusado pela Melhor Envio como invalid_client)', () => {
    delete process.env.SITE_URL;
    expect(() => buildAuthorizeUrl(false, 'x')).toThrow(/SITE_URL/);
  });

  it('o link de autorização leva client_id, retorno, response_type=code, escopo de cotação e o state', () => {
    const url = new URL(buildAuthorizeUrl(false, 'estado-123'));
    expect(url.origin + url.pathname).toBe('https://melhorenvio.com.br/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('1234');
    expect(url.searchParams.get('redirect_uri')).toBe('https://loja.exemplo.com.br/api/shipping/melhor-envio/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('shipping-calculate');
    expect(url.searchParams.get('state')).toBe('estado-123');
  });

  it('modo sandbox usa o endereço de testes', () => {
    expect(buildAuthorizeUrl(true, 'x')).toMatch(/^https:\/\/sandbox\.melhorenvio\.com\.br\/oauth\/authorize\?/);
  });
});

describe('state (proteção contra autorização forjada)', () => {
  it('aceita um state recém-criado, uma única vez', () => {
    const state = createState();
    expect(consumeState(state)).toBe(true);
    expect(consumeState(state)).toBe(false); // não pode repetir
  });
  it('recusa state adulterado, vazio ou de outro formato', () => {
    const state = createState();
    expect(consumeState(state.slice(0, -2) + 'xx')).toBe(false);
    expect(consumeState('')).toBe(false);
    expect(consumeState('lixo')).toBe(false);
    expect(consumeState(undefined as unknown as string)).toBe(false);
  });
  it('recusa state com mais de 10 minutos', () => {
    const t0 = 1_000_000_000_000;
    const state = createState(t0);
    expect(consumeState(state, t0 + 10 * 60 * 1000 + 1)).toBe(false);
    const fresh = createState(t0);
    expect(consumeState(fresh, t0 + 9 * 60 * 1000)).toBe(true);
  });
});

describe('connectWithCode', () => {
  it('troca o código pelos tokens e guarda os dois cifrados, com a data de vencimento', async () => {
    fetchMock.mockResolvedValue(tokenReply());
    const before = Date.now();
    await connectWithCode('codigo-da-autorizacao');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://melhorenvio.com.br/oauth/token');
    expect(init.method).toBe('POST');
    expect(init.headers['User-Agent']).toMatch(/Cabo Frio Outlet/);
    expect(JSON.parse(init.body)).toEqual({
      grant_type: 'authorization_code',
      client_id: '1234',
      client_secret: 'segredo-do-app',
      redirect_uri: 'https://loja.exemplo.com.br/api/shipping/melhor-envio/callback',
      code: 'codigo-da-autorizacao',
    });

    const data = savedData();
    expect(String(data['melhorEnvioToken']).startsWith('enc:v1:')).toBe(true);
    expect(String(data['melhorEnvioRefreshToken']).startsWith('enc:v1:')).toBe(true);
    expect(JSON.stringify(data)).not.toContain('acesso-novo');
    expect(JSON.stringify(data)).not.toContain('renovacao-nova');
    expect(decryptField(data['melhorEnvioToken'] as string)).toBe('acesso-novo');
    expect(decryptField(data['melhorEnvioRefreshToken'] as string)).toBe('renovacao-nova');
    const expires = (data['melhorEnvioTokenExpiresAt'] as Date).getTime();
    expect(expires).toBeGreaterThanOrEqual(before + 2592000 * 1000 - 1000);
  });

  it('resposta sem validade usa 30 dias', async () => {
    fetchMock.mockResolvedValue(tokenReply({ expires_in: undefined }));
    await connectWithCode('c');
    const expires = (savedData()['melhorEnvioTokenExpiresAt'] as Date).getTime();
    expect(Math.abs(expires - (Date.now() + 30 * DAY))).toBeLessThan(5000);
  });

  it('recusa da Melhor Envio vira erro e NADA é gravado (a mensagem não vaza o segredo do app)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }), text: async () => '{"error":"invalid_grant"}' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = await connectWithCode('c').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('segredo-do-app');
    expect(prisma().settings.upsert).not.toHaveBeenCalled();
  });

  it('resposta sem access_token também é erro', async () => {
    fetchMock.mockResolvedValue(tokenReply({ access_token: undefined }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(connectWithCode('c')).rejects.toThrow();
    expect(prisma().settings.upsert).not.toHaveBeenCalled();
  });

  it('sem as credenciais do app no servidor: erro claro, sem chamar a rede', async () => {
    delete process.env.MELHOR_ENVIO_CLIENT_SECRET;
    await expect(connectWithCode('c')).rejects.toThrow(/credenciais/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem SITE_URL: erro claro, sem chamar a rede (o redirect_uri da troca tem que ser o mesmo da autorização)', async () => {
    delete process.env.SITE_URL;
    await expect(connectWithCode('c')).rejects.toThrow(/SITE_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getAccessToken', () => {
  it('token longe do vencimento: devolve o atual (decifrado), sem rede', async () => {
    expect(await getAccessToken()).toBe('acesso-atual');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem conexão: null', async () => {
    prisma().settings.findUnique.mockResolvedValue(stored({ melhorEnvioToken: null }) as never);
    expect(await getAccessToken()).toBeNull();
    prisma().settings.findUnique.mockResolvedValue(null as never);
    expect(await getAccessToken()).toBeNull();
  });

  it('perto de vencer (menos de 7 dias): renova antes, guarda o novo par e devolve o token novo', async () => {
    prisma().settings.findUnique.mockResolvedValue(stored({ melhorEnvioTokenExpiresAt: new Date(Date.now() + 2 * DAY) }) as never);
    fetchMock.mockResolvedValue(tokenReply());
    expect(await getAccessToken()).toBe('acesso-novo');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'renovacao-atual',
      client_id: '1234',
      client_secret: 'segredo-do-app',
    });
    expect(decryptField(savedData()['melhorEnvioRefreshToken'] as string)).toBe('renovacao-nova');
  });

  it('se a renovação falhar mas o token ainda vale, continua usando o atual; se já venceu, null', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}), text: async () => 'x' });
    prisma().settings.findUnique.mockResolvedValue(stored({ melhorEnvioTokenExpiresAt: new Date(Date.now() + 2 * DAY) }) as never);
    expect(await getAccessToken()).toBe('acesso-atual');
    prisma().settings.findUnique.mockResolvedValue(stored({ melhorEnvioTokenExpiresAt: new Date(Date.now() - 1000) }) as never);
    expect(await getAccessToken()).toBeNull();
  });

  it('valor gravado que não decifra (chave trocada, dado corrompido): null, sem derrubar o checkout', async () => {
    prisma().settings.findUnique.mockResolvedValue(stored({ melhorEnvioToken: 'enc:v1:quebrado' }) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await getAccessToken()).toBeNull();
  });
});

describe('refreshAccessToken', () => {
  it('duas renovações ao mesmo tempo viram uma só chamada à Melhor Envio', async () => {
    let release!: () => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { release = () => resolve(tokenReply()); }));
    const a = refreshAccessToken();
    const b = refreshAccessToken();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    release();
    expect(await a).toBe('acesso-novo');
    expect(await b).toBe('acesso-novo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sem token de renovação, sem credenciais ou erro de rede: null, sem lançar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    prisma().settings.findUnique.mockResolvedValue(stored({ melhorEnvioRefreshToken: null }) as never);
    expect(await refreshAccessToken()).toBeNull();
    prisma().settings.findUnique.mockResolvedValue(stored() as never);
    fetchMock.mockRejectedValue(new Error('rede'));
    expect(await refreshAccessToken()).toBeNull();
    delete process.env.MELHOR_ENVIO_CLIENT_ID;
    expect(await refreshAccessToken()).toBeNull();
  });

  it('se a Melhor Envio não mandar um novo token de renovação, mantém o que já tinha', async () => {
    fetchMock.mockResolvedValue(tokenReply({ refresh_token: undefined }));
    await refreshAccessToken();
    expect(decryptField(savedData()['melhorEnvioRefreshToken'] as string)).toBe('renovacao-atual');
  });
});

describe('disconnect e status', () => {
  it('desconectar apaga os tokens e a validade', async () => {
    prisma().settings.updateMany.mockResolvedValue({ count: 1 } as never);
    await disconnect();
    expect(prisma().settings.updateMany).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { melhorEnvioToken: null, melhorEnvioRefreshToken: null, melhorEnvioTokenExpiresAt: null },
    });
  });

  it('status: conectado, validade e se as credenciais do app estão no servidor; nunca devolve token', async () => {
    const status = await getConnectionStatus();
    expect(status).toMatchObject({ configured: true, connected: true, needsReconnect: false, sandbox: false });
    expect(status.expiresAt).toEqual(expect.any(String));
    expect(JSON.stringify(status)).not.toContain('acesso-atual');
  });

  it('status: diz o que falta para conectar (credenciais do app, SITE_URL ou os dois)', async () => {
    expect(await getConnectionStatus()).toMatchObject({ configured: true, missing: [] });
    delete process.env.SITE_URL;
    expect(await getConnectionStatus()).toMatchObject({ configured: false, missing: ['siteUrl'] });
    delete process.env.MELHOR_ENVIO_CLIENT_SECRET;
    expect(await getConnectionStatus()).toMatchObject({ configured: false, missing: ['credentials', 'siteUrl'] });
  });

  it('status: token vencido pede reconexão; sem token, não está conectado; sem credenciais, não está configurado', async () => {
    prisma().settings.findUnique.mockResolvedValue(stored({ melhorEnvioTokenExpiresAt: new Date(Date.now() - 1000) }) as never);
    expect(await getConnectionStatus()).toMatchObject({ connected: true, needsReconnect: true });
    prisma().settings.findUnique.mockResolvedValue(stored({ melhorEnvioToken: null, melhorEnvioRefreshToken: null, melhorEnvioTokenExpiresAt: null }) as never);
    expect(await getConnectionStatus()).toMatchObject({ connected: false, needsReconnect: false, expiresAt: null });
    delete process.env.MELHOR_ENVIO_CLIENT_ID;
    expect(await getConnectionStatus()).toMatchObject({ configured: false });
  });
});
