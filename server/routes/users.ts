import { Router } from 'express';
import { requirePermission } from '../middleware/permissions.js';
import { prisma } from '../db.js';
import { openCpf } from '../utils/cpf-vault.js';

export const usersRouter = Router();

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isAdmin: boolean;
  createdAt: Date;
}) {
  const { passwordHash: _drop, ...rest } = user as typeof user & { passwordHash?: string };
  return { ...rest, cpf: openCpf(rest.cpf) };
}

usersRouter.get('/', requirePermission('clientes', 'view'), async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users.map(serializeUser));
});
