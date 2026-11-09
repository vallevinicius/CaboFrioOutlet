import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { corsOrigin, createRateLimiter, securityHeaders, staticCacheControl } from './security';

function mockRes() {
  const headers: Record<string, string> = {};
  const res = {
    headers,
    statusCode: 200,
    body: undefined as unknown,
    setHeader: (k: string, v: string) => (headers[k] = v),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  };
  return res as typeof res & Response;
}

describe('securityHeaders', () => {
  it('define os cabeçalhos básicos e só envia HSTS em https', () => {
    const res = mockRes();
    const next = vi.fn();
    securityHeaders({ secure: false, headers: {} } as unknown as Request, res, next);
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(res.headers['Strict-Transport-Security']).toBeUndefined();
    expect(next).toHaveBeenCalled();

    const secure = mockRes();
    securityHeaders({ secure: false, headers: { 'x-forwarded-proto': 'https' } } as unknown as Request, secure, vi.fn());
    expect(secure.headers['Strict-Transport-Security']).toContain('max-age');
  });
});

describe('createRateLimiter', () => {
  const req = (ip = '1.1.1.1') => ({ ip }) as Request;

  it('libera até o limite e bloqueia o excedente com 429 e Retry-After', () => {
    let t = 0;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, now: () => t });
    const next = vi.fn();
    for (let i = 0; i < 3; i++) limiter(req(), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(3);

    const blocked = mockRes();
    limiter(req(), blocked, next);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBe('60');
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('cada IP tem a sua própria contagem', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, now: () => 0 });
    const next = vi.fn();
    limiter(req('1.1.1.1'), mockRes(), next);
    limiter(req('2.2.2.2'), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('a janela reinicia depois do tempo', () => {
    let t = 0;
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });
    const next = vi.fn();
    limiter(req(), mockRes(), next);
    const blocked = mockRes();
    limiter(req(), blocked, next);
    expect(blocked.statusCode).toBe(429);
    t = 1500;
    limiter(req(), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe('corsOrigin', () => {
  it('em produção com SITE_URL válida restringe ao site; fora disso, libera', () => {
    expect(corsOrigin('https://loja.com.br/', 'production')).toBe('https://loja.com.br');
    expect(corsOrigin('https://loja.com.br', 'development')).toBe(true);
    expect(corsOrigin(undefined, 'production')).toBe(true);
    expect(corsOrigin('javascript:alert(1)', 'production')).toBe(true);
  });
});

describe('staticCacheControl', () => {
  it('index.html nunca é cacheado; arquivos com hash por 1 ano; o resto por 1 dia', () => {
    expect(staticCacheControl('/x/browser/index.html')).toBe('no-cache');
    expect(staticCacheControl('/x/browser/main-EIA4U4D7.js')).toContain('immutable');
    expect(staticCacheControl('/x/browser/styles-IKLNSDNE.css')).toContain('immutable');
    expect(staticCacheControl('/x/browser/placeholders/hero-1.jpg')).toBe('public, max-age=86400');
  });
});
