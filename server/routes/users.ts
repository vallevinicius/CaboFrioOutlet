import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

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
  return rest;
}

usersRouter.get('/', requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users.map(serializeUser));
});

usersRouter.patch('/:id/admin', requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const { isAdmin } = req.body as { isAdmin?: boolean };

  if (typeof isAdmin !== 'boolean') {
    return res.status(400).json({ error: 'Informe isAdmin como true ou false.' });
  }

  if (!isAdmin) {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.isAdmin && adminCount <= 1) {
      return res.status(400).json({ error: 'Não é possível remover o último administrador.' });
    }
  }

  const user = await prisma.user.update({ where: { id }, data: { isAdmin } });
  res.json(serializeUser(user));
});
