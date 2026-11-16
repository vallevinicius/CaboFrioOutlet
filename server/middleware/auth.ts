import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { StaffAccess } from '../services/access.js';

const JWT_SECRET_ENV = process.env.JWT_SECRET;

if (!JWT_SECRET_ENV) {
  throw new Error('JWT_SECRET não definido no .env');
}

const JWT_SECRET: string = JWT_SECRET_ENV;

export interface AuthTokenPayload {
  sub: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      /** Preenchido pelos middlewares de permissão (lido do banco na requisição). */
      access?: StaffAccess;
    }
  }
}

export function readToken(req: Request): AuthTokenPayload | null {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const payload = readToken(req);
  if (!payload) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
  req.user = payload;
  next();
}

/** Anexa o usuário logado se houver token válido, mas nunca bloqueia a requisição (usado no checkout, que também aceita visitantes). */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const payload = readToken(req);
  if (payload) req.user = payload;
  next();
}

export { JWT_SECRET };
