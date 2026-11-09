import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Cabeçalhos de segurança básicos. CSP fica de fora de propósito: o site usa scripts de terceiros (Mercado Pago, Google, Meta). */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  const https = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (https) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  next();
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  now?: () => number;
}

/**
 * Limitador em memória (janela fixa por IP). Suficiente para uma instância
 * única; com várias instâncias, trocar por um limitador compartilhado (Redis).
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const { windowMs, max, message = 'Muitas tentativas. Aguarde um pouco e tente de novo.' } = options;
  const now = options.now ?? Date.now;
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = now();

  return (req, res, next) => {
    const t = now();
    if (t - lastSweep > windowMs) {
      for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
      lastSweep = t;
    }

    const key = req.ip ?? 'desconhecido';
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}

/** Em produção com SITE_URL definida, só o próprio site pode chamar a API pelo navegador. */
export function corsOrigin(siteUrl: string | undefined, nodeEnv: string | undefined): string | boolean {
  const configured = siteUrl?.trim().replace(/\/+$/, '');
  if (nodeEnv === 'production' && configured && /^https?:\/\//i.test(configured)) return configured;
  return true;
}

/** Arquivos com hash no nome (build do Angular) podem ser cacheados por um ano; o resto, por pouco tempo. */
export function staticCacheControl(filePath: string): string {
  const name = filePath.split('/').pop() ?? '';
  if (/\.html?$/i.test(name)) return 'no-cache';
  if (/-[A-Z0-9]{8}\.(js|css|woff2?)$/.test(name)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=86400';
}
