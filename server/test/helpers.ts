import express, { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import type { DeepMockProxy } from 'vitest-mock-extended';
import type { Permissions } from '../services/access.js';

export const TEST_JWT_SECRET = 'segredo-de-teste';

/** Monta um app Express só com o router em teste. */
export function appWith(path: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  return app;
}

export function tokenFor(userId: string, isAdmin = false): string {
  return `Bearer ${jwt.sign({ sub: userId, isAdmin }, TEST_JWT_SECRET)}`;
}

/** Editar em todas as telas (equivale ao perfil "Administrador"). */
export const FULL_EDIT: Permissions = {
  inicio: 'edit',
  banners: 'edit',
  produtos: 'edit',
  estoque: 'edit',
  pedidos: 'edit',
  atacado: 'edit',
  clientes: 'edit',
  configuracoes: 'edit',
};

export interface FakeAccess {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  permissions?: Permissions;
}

/**
 * Programa o `prisma.user.findUnique` que o `loadAccess` usa para o usuário `userId`.
 * Qualquer outro id cai em `other` (padrão: um cliente comum, sem acesso à equipe), para a rota em teste
 * poder consultar outros usuários sem atrapalhar a autorização.
 */
export function mockAccess(
  prisma: DeepMockProxy<PrismaClient>,
  userId: string,
  access: FakeAccess | null,
  other: (id: string) => unknown = () => ({ isAdmin: false, isSuperAdmin: false, role: null }),
): void {
  prisma.user.findUnique.mockImplementation(((args: { where: { id?: string } }) => {
    if (args.where.id !== userId) return Promise.resolve(other(args.where.id ?? ''));
    if (!access) return Promise.resolve(null);
    const permissions = Object.entries(access.permissions ?? {}).map(([section, level]) => ({
      section,
      level: level === 'edit' ? 'EDIT' : 'VIEW',
    }));
    return Promise.resolve({
      isAdmin: access.isAdmin ?? true,
      isSuperAdmin: access.isSuperAdmin ?? false,
      role: { permissions },
    });
  }) as never);
}
