import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Level, Section, StaffAccess, allows, loadAccess } from '../services/access.js';
import { readToken } from './auth.js';

/**
 * Autoriza pelo que está no banco agora (nunca pelo token): mudar o perfil de alguém
 * ou remover o acesso vale na próxima requisição.
 */
function guard(check: (access: StaffAccess) => boolean, deniedMessage: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = readToken(req);
      if (!payload) return res.status(401).json({ error: 'Autenticação necessária.' });

      const access = await loadAccess(payload.sub);
      if (!access) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
      if (!access.isAdmin && !access.isSuperAdmin) {
        return res.status(403).json({ error: 'Acesso restrito à equipe.' });
      }
      if (!check(access)) return res.status(403).json({ error: deniedMessage });

      req.user = payload;
      req.access = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}

const DENIED = 'Sem permissão para esta área.';

export function requirePermission(section: Section, level: Level): RequestHandler {
  return guard((access) => allows(access, section, level), DENIED);
}

/** Basta uma das permissões (rotas compartilhadas entre telas, como o estoque). */
export function requireAnyPermission(...needs: [Section, Level][]): RequestHandler {
  return guard((access) => needs.some(([section, level]) => allows(access, section, level)), DENIED);
}

export const requireSuperAdmin: RequestHandler = guard(
  (access) => access.isSuperAdmin,
  'Apenas o administrador supremo pode fazer isso.',
);
