import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { MAX_FAVORITES, normalizeProductIds } from '../utils/favorites';

export const favoritesRouter = Router();

// Tudo aqui é filtrado pelo userId do token: ninguém lê ou altera favoritos de outra conta.
favoritesRouter.use(requireAuth);

async function listIds(userId: string): Promise<string[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { productId: true },
    orderBy: { createdAt: 'desc' },
    take: MAX_FAVORITES,
  });
  return rows.map((r) => r.productId);
}

favoritesRouter.get('/', async (req, res) => {
  res.json({ productIds: await listIds(req.user!.sub) });
});

// Junta os favoritos salvos no navegador (visitante) com os da conta, ao fazer login.
favoritesRouter.post('/merge', async (req, res) => {
  const ids = normalizeProductIds((req.body as { productIds?: unknown }).productIds);
  if (ids === null) return res.status(400).json({ error: 'Lista de favoritos inválida.' });
  const userId = req.user!.sub;

  const existingProducts = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (existingProducts.length > 0) {
    await prisma.favorite.createMany({
      data: existingProducts.map((p) => ({ userId, productId: p.id })),
      skipDuplicates: true,
    });
  }
  res.json({ productIds: await listIds(userId) });
});

favoritesRouter.put('/:productId', async (req, res) => {
  const userId = req.user!.sub;
  const productId = req.params.productId as string;
  const [id] = normalizeProductIds([productId]) ?? [];
  if (!id) return res.status(400).json({ error: 'Produto inválido.' });

  const count = await prisma.favorite.count({ where: { userId } });
  const already = await prisma.favorite.findUnique({ where: { userId_productId: { userId, productId: id } } });
  if (!already && count >= MAX_FAVORITES) {
    return res.status(409).json({ error: 'Limite de favoritos atingido.' });
  }

  try {
    await prisma.favorite.upsert({
      where: { userId_productId: { userId, productId: id } },
      update: {},
      create: { userId, productId: id },
    });
  } catch (err) {
    // P2003: produto inexistente (violação de chave estrangeira)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    throw err;
  }
  res.status(204).end();
});

favoritesRouter.delete('/:productId', async (req, res) => {
  const [id] = normalizeProductIds([req.params.productId]) ?? [];
  if (!id) return res.status(400).json({ error: 'Produto inválido.' });
  await prisma.favorite.deleteMany({ where: { userId: req.user!.sub, productId: id } });
  res.status(204).end();
});
