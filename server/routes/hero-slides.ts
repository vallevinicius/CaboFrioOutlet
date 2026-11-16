import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

export const heroSlidesRouter = Router();

interface SlidePayload {
  image?: string;
  eyebrow?: string;
  title?: string;
  highlight?: string;
  subtitle?: string;
  ctaLabel?: string;
}

function validatePayload(body: unknown): body is SlidePayload & { image: string; title: string } {
  const p = body as Partial<SlidePayload>;
  return Boolean(p && typeof p.image === 'string' && p.image.trim() && typeof p.title === 'string' && p.title.trim());
}

heroSlidesRouter.get('/', async (_req, res) => {
  const slides = await prisma.heroSlide.findMany({ orderBy: { order: 'asc' } });
  res.json(slides);
});

heroSlidesRouter.post('/', requireAdmin, async (req, res) => {
  if (!validatePayload(req.body)) {
    return res.status(400).json({ error: 'Informe ao menos a imagem e o título.' });
  }
  const { image, eyebrow, title, highlight, subtitle, ctaLabel } = req.body;

  const last = await prisma.heroSlide.findFirst({ orderBy: { order: 'desc' } });
  const slide = await prisma.heroSlide.create({
    data: {
      image,
      title: title.trim(),
      eyebrow: eyebrow?.trim() ?? '',
      highlight: highlight?.trim() ?? '',
      subtitle: subtitle?.trim() ?? '',
      ctaLabel: ctaLabel?.trim() || 'Ver Coleção',
      order: (last?.order ?? -1) + 1,
    },
  });
  res.status(201).json(slide);
});

heroSlidesRouter.put('/:id', requireAdmin, async (req, res) => {
  if (!validatePayload(req.body)) {
    return res.status(400).json({ error: 'Informe ao menos a imagem e o título.' });
  }
  const id = req.params.id as string;
  const { image, eyebrow, title, highlight, subtitle, ctaLabel } = req.body;

  try {
    const slide = await prisma.heroSlide.update({
      where: { id },
      data: {
        image,
        title: title.trim(),
        eyebrow: eyebrow?.trim() ?? '',
        highlight: highlight?.trim() ?? '',
        subtitle: subtitle?.trim() ?? '',
        ctaLabel: ctaLabel?.trim() || 'Ver Coleção',
      },
    });
    res.json(slide);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Banner não encontrado.' });
    }
    throw err;
  }
});

heroSlidesRouter.patch('/:id/move', requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const { direction } = req.body as { direction?: 'up' | 'down' };
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'Informe a direção up ou down.' });
  }

  const slides = await prisma.heroSlide.findMany({ orderBy: { order: 'asc' } });
  const index = slides.findIndex((s) => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Banner não encontrado.' });
  }

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= slides.length) {
    return res.json(slides);
  }

  const current = slides[index]!;
  const swapWith = slides[swapIndex]!;
  await prisma.$transaction([
    prisma.heroSlide.update({ where: { id: current.id }, data: { order: swapWith.order } }),
    prisma.heroSlide.update({ where: { id: swapWith.id }, data: { order: current.order } }),
  ]);

  const updated = await prisma.heroSlide.findMany({ orderBy: { order: 'asc' } });
  res.json(updated);
});

heroSlidesRouter.delete('/:id', requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.heroSlide.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Banner não encontrado.' });
    }
    throw err;
  }
});
