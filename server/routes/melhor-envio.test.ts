import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { appWith, mockAccess, tokenFor } from '../test/helpers.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});
const auth = vi.hoisted(() => ({
  getConnectionStatus: vi.fn(),
  buildAuthorizeUrl: vi.fn(),
  createState: vi.fn(),
  consumeState: vi.fn(),
  connectWithCode: vi.fn(),
  disconnect: vi.fn(),
  redirectUri: vi.fn(),
}));
vi.mock('../services/melhor-envio-auth', () => auth);

import { melhorEnvioRouter } from './melhor-envio.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/shipping/melhor-envio', melhorEnvioRouter);
const status = { configured: true, missing: [] as string[], connected: false, expiresAt: null, needsReconnect: false, sandbox: false };
const bearer = (userId: string) => ({ Authorization: tokenFor(userId, true) });

beforeEach(() => {
  mockReset(prisma());
  Object.values(auth).forEach((fn) => fn.mockReset());
  auth.getConnectionStatus.mockResolvedValue(status);
  auth.redirectUri.mockReturnValue('https://loja.exemplo.com.br/api/shipping/melhor-envio/callback');
  auth.createState.mockReturnValue('estado-novo');
  auth.buildAuthorizeUrl.mockReturnValue('https://melhorenvio.com.br/oauth/authorize?x=1');
  auth.connectWithCode.mockResolvedValue(undefined);
  auth.disconnect.mockResolvedValue(undefined);
  mockAccess(prisma(), 'editor', { permissions: { configuracoes: 'edit' } });
});

describe('acesso: só quem mexe em Configurações', () => {
  it('sem token 401; cliente 403; perfil sem Configurações 403; só ver não conecta nem desconecta', async () => {
    await request(app).get('/api/shipping/melhor-envio/status').expect(401);
    mockAccess(prisma(), 'cliente', { isAdmin: false });
    await request(app).post('/api/shipping/melhor-envio/connect').set(bearer('cliente')).expect(403);
    mockAccess(prisma(), 'estoquista', { permissions: { estoque: 'edit' } });
    await request(app).get('/api/shipping/melhor-envio/status').set(bearer('estoquista')).expect(403);
    mockAccess(prisma(), 'leitor', { permissions: { configuracoes: 'view' } });
    await request(app).get('/api/shipping/melhor-envio/status').set(bearer('leitor')).expect(200);
    await request(app).post('/api/shipping/melhor-envio/connect').set(bearer('leitor')).expect(403);
    await request(app).delete('/api/shipping/melhor-envio').set(bearer('leitor')).expect(403);
    expect(auth.disconnect).not.toHaveBeenCalled();
    expect(auth.createState).not.toHaveBeenCalled();
  });
});

describe('GET /status', () => {
  it('mostra o estado da conexão e o endereço de retorno que precisa estar no app', async () => {
    const res = await request(app).get('/api/shipping/melhor-envio/status').set(bearer('editor')).expect(200);
    expect(res.body).toEqual({ ...status, redirectUri: 'https://loja.exemplo.com.br/api/shipping/melhor-envio/callback' });
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
  });
});

describe('POST /connect', () => {
  it('devolve o link de autorização (com um state novo) para o painel abrir', async () => {
    const res = await request(app).post('/api/shipping/melhor-envio/connect').set(bearer('editor')).expect(200);
    expect(res.body).toEqual({ url: 'https://melhorenvio.com.br/oauth/authorize?x=1' });
    expect(auth.buildAuthorizeUrl).toHaveBeenCalledWith(false, 'estado-novo');
  });
  it('sem as credenciais do app no servidor: 409 com a explicação', async () => {
    auth.getConnectionStatus.mockResolvedValue({ ...status, configured: false, missing: ['credentials'] });
    const res = await request(app).post('/api/shipping/melhor-envio/connect').set(bearer('editor')).expect(409);
    expect(res.body.error).toMatch(/credenciais/i);
    expect(res.body.error).toMatch(/\.env/);
    expect(auth.buildAuthorizeUrl).not.toHaveBeenCalled();
  });
  it('sem SITE_URL no servidor: 409 dizendo exatamente o que colocar (em vez de mandar um link que a Melhor Envio recusa)', async () => {
    auth.getConnectionStatus.mockResolvedValue({ ...status, configured: false, missing: ['siteUrl'] });
    const res = await request(app).post('/api/shipping/melhor-envio/connect').set(bearer('editor')).expect(409);
    expect(res.body.error).toMatch(/SITE_URL/);
    expect(res.body.error).toMatch(/https:\/\//);
    expect(auth.buildAuthorizeUrl).not.toHaveBeenCalled();
  });
  it('faltando as duas coisas, a mensagem cita as duas', async () => {
    auth.getConnectionStatus.mockResolvedValue({ ...status, configured: false, missing: ['credentials', 'siteUrl'] });
    const res = await request(app).post('/api/shipping/melhor-envio/connect').set(bearer('editor')).expect(409);
    expect(res.body.error).toMatch(/credenciais/i);
    expect(res.body.error).toMatch(/SITE_URL/);
  });
});

describe('GET /callback (a Melhor Envio devolve o navegador para cá)', () => {
  it('state válido + code: conecta e volta ao painel com aviso de sucesso', async () => {
    auth.consumeState.mockReturnValue(true);
    const res = await request(app).get('/api/shipping/melhor-envio/callback?code=abc&state=estado-novo').expect(302);
    expect(auth.consumeState).toHaveBeenCalledWith('estado-novo');
    expect(auth.connectWithCode).toHaveBeenCalledWith('abc');
    expect(res.headers.location).toBe('/admin?frete=conectado');
  });

  it('state inválido ou ausente: não troca o código (autorização forjada) e volta com erro', async () => {
    auth.consumeState.mockReturnValue(false);
    const a = await request(app).get('/api/shipping/melhor-envio/callback?code=abc&state=forjado').expect(302);
    const b = await request(app).get('/api/shipping/melhor-envio/callback?code=abc').expect(302);
    expect(a.headers.location).toBe('/admin?frete=erro');
    expect(b.headers.location).toBe('/admin?frete=erro');
    expect(auth.connectWithCode).not.toHaveBeenCalled();
  });

  it('o usuário negou a autorização na Melhor Envio: volta com aviso de cancelado', async () => {
    auth.consumeState.mockReturnValue(true);
    const res = await request(app).get('/api/shipping/melhor-envio/callback?error=access_denied&state=estado-novo').expect(302);
    expect(res.headers.location).toBe('/admin?frete=cancelado');
    expect(auth.connectWithCode).not.toHaveBeenCalled();
  });

  it('sem code, ou troca de token falhou: volta com erro (sem expor detalhe na URL)', async () => {
    auth.consumeState.mockReturnValue(true);
    const semCode = await request(app).get('/api/shipping/melhor-envio/callback?state=estado-novo').expect(302);
    expect(semCode.headers.location).toBe('/admin?frete=erro');
    auth.consumeState.mockReturnValue(true);
    auth.connectWithCode.mockRejectedValue(new Error('A Melhor Envio recusou a solicitação.'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const falhou = await request(app).get('/api/shipping/melhor-envio/callback?code=abc&state=estado-novo').expect(302);
    expect(falhou.headers.location).toBe('/admin?frete=erro');
  });

  it('code ou state em formato estranho (array, objeto) não derruba a rota', async () => {
    auth.consumeState.mockReturnValue(false);
    await request(app).get('/api/shipping/melhor-envio/callback?code[]=a&state[x]=b').expect(302);
    expect(auth.connectWithCode).not.toHaveBeenCalled();
  });
});

describe('DELETE /', () => {
  it('desconecta e responde 204', async () => {
    await request(app).delete('/api/shipping/melhor-envio').set(bearer('editor')).expect(204);
    expect(auth.disconnect).toHaveBeenCalledTimes(1);
  });
});
