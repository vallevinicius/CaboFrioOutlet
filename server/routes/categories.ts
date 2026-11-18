import { Router } from 'express';
import { Category, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requirePermission } from '../middleware/permissions.js';
import { slugify, validateSlug } from '../utils/category-slug.js';

export const categoriesRouter = Router();

/** Categorias visíveis no site, em ordem. Usada também pelo SEO, sitemap e atacado. */
export function listActiveCategories(): Promise<Category[]> {
  return prisma.category.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
}

function serialize(c: Category) {
  return {
    id: c.id,
    key: c.key,
    slug: c.slug,
    name: c.name,
    intro: c.intro,
    description: c.description,
    image: c.image,
    order: c.order,
    active: c.active,
  };
}

const text = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
const fields = {
  name: text(60).min(1, 'Informe o nome da categoria.'),
  intro: text(500).default(''),
  description: text(500).default(''),
  image: text(191).default(''),
};
const createInput = z.object(fields);
const updateInput = z.object({ ...fields, active: z.boolean() });

const firstError = (err: z.ZodError) => err.issues[0]?.message ?? 'Dados inválidos.';
const isPrismaError = (err: unknown, code: string) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

categoriesRouter.get('/', async (_req, res) => {
  const categories = await listActiveCategories();
  res.json(categories.map(serialize));
});

categoriesRouter.get('/all', requirePermission('produtos', 'view'), async (_req, res) => {
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: 'asc' } }),
    prisma.product.groupBy({ by: ['category'], _count: { _all: true } }),
  ]);
  const byKey = new Map(counts.map((c) => [c.category, c._count._all]));
  res.json(categories.map((c) => ({ ...serialize(c), productCount: byKey.get(c.key) ?? 0 })));
});

categoriesRouter.post('/', requirePermission('produtos', 'edit'), async (req, res) => {
  const parsed = createInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });

  const slug = slugify(parsed.data.name);
  const slugError = validateSlug(slug);
  if (slugError) return res.status(400).json({ error: slugError });

  const last = await prisma.category.findFirst({ orderBy: { order: 'desc' } });
  try {
    const category = await prisma.category.create({
      data: { key: slug, slug, ...parsed.data, order: (last?.order ?? -1) + 1, active: true },
    });
    res.status(201).json(serialize(category));
  } catch (err) {
    if (isPrismaError(err, 'P2002')) {
      return res.status(409).json({ error: `Já existe uma categoria com o endereço /${slug}.` });
    }
    throw err;
  }
});

categoriesRouter.put('/:id', requirePermission('produtos', 'edit'), async (req, res) => {
  const parsed = updateInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });
  try {
    // key e slug ficam de fora de propósito: mudá-los quebraria produtos e links.
    const category = await prisma.category.update({ where: { id: req.params.id as string }, data: parsed.data });
    res.json(serialize(category));
  } catch (err) {
    if (isPrismaError(err, 'P2025')) return res.status(404).json({ error: 'Categoria não encontrada.' });
    throw err;
  }
});

categoriesRouter.patch('/:id/move', requirePermission('produtos', 'edit'), async (req, res) => {
  const { direction } = (req.body ?? {}) as { direction?: unknown };
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'Informe a direção up ou down.' });
  }
  const all = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  const index = all.findIndex((c) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Categoria não encontrada.' });

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex >= 0 && swapIndex < all.length) {
    const current = all[index]!;
    const other = all[swapIndex]!;
    await prisma.$transaction([
      prisma.category.update({ where: { id: current.id }, data: { order: other.order } }),
      prisma.category.update({ where: { id: other.id }, data: { order: current.order } }),
    ]);
  }
  const updated = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  res.json(updated.map(serialize));
});

categoriesRouter.delete('/:id', requirePermission('produtos', 'edit'), async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: req.params.id as string } });
  if (!category) return res.status(404).json({ error: 'Categoria não encontrada.' });

  const products = await prisma.product.count({ where: { category: category.key } });
  if (products > 0) {
    return res.status(409).json({
      error: `Esta categoria tem ${products} produto(s). Mova os produtos para outra categoria ou oculte a categoria.`,
    });
  }
  await prisma.category.delete({ where: { id: category.id } });
  res.status(204).end();
});
