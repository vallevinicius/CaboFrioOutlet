import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireSuperAdmin } from '../middleware/permissions.js';
import { SECTIONS, type Level, type Section } from '../services/access.js';

export const rolesRouter = Router();
rolesRouter.use(requireSuperAdmin);

const roleInput = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome do perfil.').max(40, 'O nome deve ter no máximo 40 caracteres.'),
    permissions: z.array(z.object({ section: z.enum(SECTIONS), level: z.enum(['view', 'edit']) })),
  })
  .refine((v) => new Set(v.permissions.map((p) => p.section)).size === v.permissions.length, {
    message: 'Cada tela só pode aparecer uma vez.',
  });

const roleSelect = {
  id: true,
  name: true,
  system: true,
  permissions: { select: { section: true, level: true }, orderBy: { section: 'asc' } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

type StoredRole = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;

function toDto(role: StoredRole) {
  return {
    id: role.id,
    name: role.name,
    system: role.system,
    userCount: role._count.users,
    permissions: role.permissions.map((p) => ({
      section: p.section as Section,
      level: (p.level === 'EDIT' ? 'edit' : 'view') as Level,
    })),
  };
}

const toRows = (permissions: { section: Section; level: Level }[]) =>
  permissions.map((p) => ({ section: p.section, level: p.level === 'edit' ? ('EDIT' as const) : ('VIEW' as const) }));

const NAME_TAKEN = 'Já existe um perfil com esse nome.';

rolesRouter.get('/', async (_req, res) => {
  const roles = await prisma.role.findMany({ select: roleSelect, orderBy: [{ system: 'desc' }, { name: 'asc' }] });
  res.json(roles.map(toDto));
});

rolesRouter.get('/:id', async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.id as string }, select: roleSelect });
  if (!role) return res.status(404).json({ error: 'Perfil não encontrado.' });
  res.json(toDto(role));
});

rolesRouter.post('/', async (req, res) => {
  const parsed = roleInput.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0].message });

  try {
    const role = await prisma.role.create({
      data: { name: parsed.data.name, permissions: { create: toRows(parsed.data.permissions) } },
      select: roleSelect,
    });
    res.status(201).json(toDto(role));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: NAME_TAKEN });
    }
    throw err;
  }
});

rolesRouter.put('/:id', async (req, res) => {
  const id = req.params.id as string;
  const parsed = roleInput.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0].message });

  const current = await prisma.role.findUnique({ where: { id }, select: { id: true, system: true } });
  if (!current) return res.status(404).json({ error: 'Perfil não encontrado.' });
  if (current.system) return res.status(403).json({ error: 'O perfil de sistema não pode ser alterado.' });

  try {
    const role = await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      return tx.role.update({
        where: { id },
        data: { name: parsed.data.name, permissions: { create: toRows(parsed.data.permissions) } },
        select: roleSelect,
      });
    });
    res.json(toDto(role));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return res.status(409).json({ error: NAME_TAKEN });
      if (err.code === 'P2025') return res.status(404).json({ error: 'Perfil não encontrado.' });
    }
    throw err;
  }
});

rolesRouter.delete('/:id', async (req, res) => {
  const id = req.params.id as string;
  const role = await prisma.role.findUnique({ where: { id }, select: roleSelect });
  if (!role) return res.status(404).json({ error: 'Perfil não encontrado.' });
  if (role.system) return res.status(403).json({ error: 'O perfil de sistema não pode ser apagado.' });
  if (role._count.users > 0) {
    return res.status(409).json({ error: `Este perfil está em uso por ${role._count.users} usuário(s).` });
  }

  try {
    await prisma.role.delete({ where: { id } });
  } catch (err) {
    // Alguém foi vinculado ao perfil entre a checagem e o delete (FK Restrict).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return res.status(409).json({ error: 'Este perfil está em uso por usuários.' });
    }
    throw err;
  }
  res.status(204).end();
});
