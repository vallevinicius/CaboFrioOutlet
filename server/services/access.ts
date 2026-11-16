import { prisma } from '../db.js';

/** Telas do painel que aceitam permissão. "Equipe" não está aqui: é exclusiva do admin supremo. */
export const SECTIONS = [
  'inicio',
  'banners',
  'produtos',
  'estoque',
  'pedidos',
  'atacado',
  'clientes',
  'configuracoes',
] as const;

export type Section = (typeof SECTIONS)[number];
export type Level = 'view' | 'edit';
export type Permissions = Partial<Record<Section, Level>>;

export interface StaffAccess {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: Permissions;
}

export function isSection(value: unknown): value is Section {
  return typeof value === 'string' && (SECTIONS as readonly string[]).includes(value);
}

/**
 * Lê do banco o que o usuário pode fazer agora. Nada vai no token: mudar um perfil
 * ou remover o acesso vale já na próxima requisição.
 */
export async function loadAccess(userId: string): Promise<StaffAccess | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isAdmin: true,
      isSuperAdmin: true,
      role: { select: { permissions: { select: { section: true, level: true } } } },
    },
  });
  if (!user) return null;

  const permissions: Permissions = {};
  if (user.isSuperAdmin) {
    for (const section of SECTIONS) permissions[section] = 'edit';
  } else if (user.isAdmin) {
    for (const p of user.role?.permissions ?? []) {
      if (isSection(p.section)) permissions[p.section] = p.level === 'EDIT' ? 'edit' : 'view';
    }
  }
  return { isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin, permissions };
}

export function allows(access: StaffAccess, section: Section, level: Level): boolean {
  if (access.isSuperAdmin) return true;
  if (!access.isAdmin) return false;
  const granted = access.permissions[section];
  if (!granted) return false;
  return level === 'view' || granted === 'edit';
}
