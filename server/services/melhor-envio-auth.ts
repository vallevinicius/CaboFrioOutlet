import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '../db.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { decryptField, encryptField } from '../utils/crypto-field.js';

/**
 * Conexão com a Melhor Envio por OAuth: o dono da loja autoriza o app uma vez (botão "Conectar" no
 * painel); o servidor guarda os tokens cifrados e renova sozinho (o de acesso vale 30 dias e o de
 * renovação, 45). As credenciais do app (client id e secret) ficam só no .env do servidor.
 */

const PRODUCTION_BASE = 'https://melhorenvio.com.br';
const SANDBOX_BASE = 'https://sandbox.melhorenvio.com.br';
const SCOPES = 'shipping-calculate';
const DEFAULT_LIFETIME_S = 30 * 24 * 60 * 60;
/** Renova quando faltam menos de 7 dias, para nunca depender do último minuto. */
const REFRESH_MARGIN_MS = 7 * 24 * 60 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;

const baseUrl = (sandbox: boolean) => (sandbox ? SANDBOX_BASE : PRODUCTION_BASE);
const userAgent = () => `Cabo Frio Outlet (${process.env.ADMIN_EMAIL ?? 'contato@cabofriooutlet.com.br'})`;

function credentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID?.trim();
  const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

const SITE_URL_MISSING = 'SITE_URL não definida no .env do servidor (ex.: SITE_URL=https://cabofriooutlet.com.br).';

/**
 * Endereço de retorno: precisa ser idêntico ao cadastrado no app da Melhor Envio. Vem do SITE_URL; sem ele
 * não existe (null), em vez de cair em localhost: a Melhor Envio responderia só "invalid_client".
 */
export function redirectUri(): string | null {
  const site = process.env.SITE_URL?.trim().replace(/\/+$/, '');
  return site ? `${site}/api/shipping/melhor-envio/callback` : null;
}

export function buildAuthorizeUrl(sandbox: boolean, state: string): string {
  const creds = credentials();
  if (!creds) throw new Error('Credenciais do app da Melhor Envio não configuradas no servidor.');
  const redirect = redirectUri();
  if (!redirect) throw new Error(SITE_URL_MISSING);
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: SCOPES,
    state,
  });
  return `${baseUrl(sandbox)}/oauth/authorize?${params.toString()}`;
}

// ── state: amarra o retorno da Melhor Envio ao clique de um administrador (e vale uma vez só) ──

const usedNonces = new Map<string, number>();

function sign(payload: string): string {
  return createHmac('sha256', JWT_SECRET).update(`melhor-envio-state:${payload}`).digest('hex');
}

export function createState(now: number = Date.now()): string {
  const payload = `${now}.${randomBytes(12).toString('hex')}`;
  return `${payload}.${sign(payload)}`;
}

/** Confere assinatura e idade (10 min) e marca como usado. */
export function consumeState(state: string, now: number = Date.now()): boolean {
  if (typeof state !== 'string') return false;
  const [ts, nonce, signature, ...extra] = state.split('.');
  if (!ts || !nonce || !signature || extra.length > 0) return false;

  const expected = Buffer.from(sign(`${ts}.${nonce}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

  const issuedAt = Number(ts);
  if (!Number.isFinite(issuedAt) || now - issuedAt > STATE_TTL_MS || issuedAt - now > 60_000) return false;

  for (const [used, at] of usedNonces) if (now - at > STATE_TTL_MS) usedNonces.delete(used);
  if (usedNonces.has(nonce)) return false;
  usedNonces.set(nonce, now);
  return true;
}

// ── tokens ──

interface TokenReply {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

async function requestTokens(sandbox: boolean, body: Record<string, string>): Promise<TokenReply> {
  const res = await fetch(`${baseUrl(sandbox)}/oauth/token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': userAgent() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    // Só status e a resposta da Melhor Envio: nunca o que enviamos (client secret, code, tokens).
    console.error('[frete] a Melhor Envio recusou a solicitação de token:', res.status, detail);
    throw new Error('A Melhor Envio recusou a solicitação.');
  }
  const data = (await res.json()) as TokenReply;
  if (!data.access_token) {
    console.error('[frete] resposta da Melhor Envio sem access_token');
    throw new Error('A Melhor Envio não devolveu o token de acesso.');
  }
  return data;
}

async function saveTokens(reply: TokenReply, previousRefresh?: string): Promise<string> {
  const access = reply.access_token as string;
  const refresh = reply.refresh_token ?? previousRefresh;
  const lifetimeS = typeof reply.expires_in === 'number' && reply.expires_in > 0 ? reply.expires_in : DEFAULT_LIFETIME_S;
  const data = {
    melhorEnvioToken: encryptField(access),
    melhorEnvioRefreshToken: refresh ? encryptField(refresh) : null,
    melhorEnvioTokenExpiresAt: new Date(Date.now() + lifetimeS * 1000),
  };
  await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, announcementMessages: '[]', brands: '[]', ...data },
  });
  return access;
}

/** Troca o código recebido no retorno da autorização pelos tokens e guarda (cifrados). */
export async function connectWithCode(code: string): Promise<void> {
  const creds = credentials();
  if (!creds) throw new Error('Credenciais do app da Melhor Envio não configuradas no servidor.');
  const redirect = redirectUri();
  if (!redirect) throw new Error(SITE_URL_MISSING);
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const reply = await requestTokens(Boolean(settings?.melhorEnvioSandbox), {
    grant_type: 'authorization_code',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: redirect,
    code,
  });
  await saveTokens(reply);
}

let refreshing: Promise<string | null> | null = null;

/** Renova o token (uma renovação por vez, mesmo com vários pedidos ao mesmo tempo). Devolve o token novo ou null. */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function doRefresh(): Promise<string | null> {
  try {
    const creds = credentials();
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!creds || !settings?.melhorEnvioRefreshToken) return null;
    const refreshToken = decryptField(settings.melhorEnvioRefreshToken);
    const reply = await requestTokens(settings.melhorEnvioSandbox, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });
    return await saveTokens(reply, refreshToken);
  } catch (err) {
    console.error('[frete] não foi possível renovar o token da Melhor Envio:', String(err));
    return null;
  }
}

/** Token de acesso válido (renovando se estiver perto de vencer) ou null se a loja não está conectada. */
export async function getAccessToken(): Promise<string | null> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.melhorEnvioToken) return null;

  let access: string;
  try {
    access = decryptField(settings.melhorEnvioToken);
  } catch (err) {
    console.error('[frete] token da Melhor Envio ilegível (chave de criptografia trocada?):', String(err));
    return null;
  }

  const expiresAt = settings.melhorEnvioTokenExpiresAt?.getTime();
  const now = Date.now();
  // Sem data de vencimento = token antigo colado à mão: usa como está.
  if (expiresAt === undefined || expiresAt - now > REFRESH_MARGIN_MS) return access;

  const refreshed = await refreshAccessToken();
  if (refreshed) return refreshed;
  return expiresAt > now ? access : null;
}

export async function disconnect(): Promise<void> {
  await prisma.settings.updateMany({
    where: { id: 1 },
    data: { melhorEnvioToken: null, melhorEnvioRefreshToken: null, melhorEnvioTokenExpiresAt: null },
  });
}

export interface ConnectionStatus {
  /** Servidor pronto para conectar: credenciais do app e SITE_URL presentes. */
  configured: boolean;
  /** O que falta no .env do servidor: credenciais do app (client id e secret) e/ou SITE_URL. */
  missing: ('credentials' | 'siteUrl')[];
  connected: boolean;
  expiresAt: string | null;
  /** Token vencido e sem como renovar: o dono precisa conectar de novo. */
  needsReconnect: boolean;
  sandbox: boolean;
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const connected = Boolean(settings?.melhorEnvioToken);
  const expiresAt = settings?.melhorEnvioTokenExpiresAt ?? null;
  const missing: ConnectionStatus['missing'] = [
    ...(credentials() === null ? (['credentials'] as const) : []),
    ...(redirectUri() === null ? (['siteUrl'] as const) : []),
  ];
  return {
    configured: missing.length === 0,
    missing,
    connected,
    expiresAt: connected && expiresAt ? expiresAt.toISOString() : null,
    needsReconnect: connected && expiresAt !== null && expiresAt.getTime() < Date.now(),
    sandbox: settings?.melhorEnvioSandbox ?? true,
  };
}
