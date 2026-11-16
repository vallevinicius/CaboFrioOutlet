import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireSuperAdmin } from '../middleware/permissions.js';

export const staffRouter = Router();
staffRouter.use(requireSuperAdmin);

const staffSelect = {
  id: true,
  name: true,
  email: true,
  isSuperAdmin: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

const name = z.string().trim().min(1, 'Informe o nome.').max(80, 'O nome deve ter no máximo 80 caracteres.');
// 72 bytes é o limite do bcrypt: acima disso o resto da senha seria ignorado em silêncio.
const password = z.string().min(8, 'A senha deve ter no mínimo 8 caracteres.').max(72, 'A senha deve ter no máximo 72 caracteres.');
const email = z.string().trim().toLowerCase().pipe(z.email('Informe um e-mail válido.'));

const createInput = z.object({ name, email, password, roleId: z.string().min(1, 'Escolha um perfil.') });
const updateInput = z
  .object({ name: name.optional(), password: password.optional(), roleId: z.string().min(1).optional() })
  .refine((v) => v.name !== undefined || v.password !== undefined || v.roleId !== undefined, {
    message: 'Informe ao menos um campo para alterar.',
  });

const EMAIL_TAKEN = 'Já existe uma conta com esse e-mail.';

async function roleExists(roleId: string): Promise<boolean> {
  return (await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } })) !== null;
}

/** Alvo precisa ser da equipe e não pode ser o supremo. Devolve o erro HTTP ou null se pode seguir. */
async function checkTarget(id: string): Promise<{ status: number; error: string } | null> {
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, isAdmin: true, isSuperAdmin: true } });
  if (!target?.isAdmin) return { status: 404, error: 'Membro da equipe não encontrado.' };
  if (target.isSuperAdmin) return { status: 403, error: 'O admin supremo não pode ser alterado.' };
  return null;
}

staffRouter.get('/', async (_req, res) => {
  const members = await prisma.user.findMany({
    where: { isAdmin: true },
    select: staffSelect,
    orderBy: { createdAt: 'asc' },
  });
  res.json(members);
});

staffRouter.post('/', async (req, res) => {
  const parsed = createInput.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0].message });
  const { name, email, password, roleId } = parsed.data;

  if (!(await roleExists(roleId))) return res.status(422).json({ error: 'Perfil não encontrado.' });

  try {
    const member = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        isAdmin: true,
        roleId,
      },
      select: staffSelect,
    });
    res.status(201).json(member);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: EMAIL_TAKEN });
    }
    throw err;
  }
});

staffRouter.patch('/:id', async (req, res) => {
  const id = req.params.id as string;
  const parsed = updateInput.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.issues[0].message });

  const denied = await checkTarget(id);
  if (denied) return res.status(denied.status).json({ error: denied.error });

  const { name, password, roleId } = parsed.data;
  if (roleId !== undefined && !(await roleExists(roleId))) {
    return res.status(422).json({ error: 'Perfil não encontrado.' });
  }

  const member = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(roleId !== undefined ? { roleId } : {}),
      ...(password !== undefined ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
    select: staffSelect,
  });
  res.json(member);
});

/** Tira o acesso à equipe; a conta continua existindo como cliente. */
staffRouter.delete('/:id', async (req, res) => {
  const id = req.params.id as string;
  const denied = await checkTarget(id);
  if (denied) return res.status(denied.status).json({ error: denied.error });

  await prisma.user.update({ where: { id }, data: { isAdmin: false, roleId: null } });
  res.status(204).end();
});
