import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth';
import { notifyWholesaleQuote } from '../services/wholesale-notifications';
import { isHoneypotFilled, validateQuote } from '../utils/wholesale';
import { parseTiers, priceWholesaleItems, QuoteLine } from '../utils/wholesale-pricing';

export const wholesaleRouter = Router();

function serialize(q: {
  id: string;
  createdAt: Date;
  name: string;
  company: string;
  cnpj: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  interests: string;
  estimatedPieces: number | null;
  message: string | null;
  items: unknown;
  estimatedTotal: number | null;
  discountPercent: number | null;
  handled: boolean;
}) {
  return {
    ...q,
    interests: q.interests ? q.interests.split(',') : [],
    message: q.message ?? '',
    items: Array.isArray(q.items) ? q.items : [],
  };
}

// Formulário público. O limite de tentativas por IP é aplicado no index.ts.
wholesaleRouter.post('/quotes', async (req, res) => {
  // Robô preencheu o campo-isca: responde como sucesso, mas não grava nem avisa.
  if (isHoneypotFilled(req.body)) return res.status(201).json({ ok: true });

  const result = validateQuote(req.body);
  if (!result.ok) return res.status(400).json({ error: result.error });
  const q = result.value;

  // Peças escolhidas no site: o servidor precifica pelo catálogo e pelas faixas do admin.
  const rawItems = (req.body as { items?: unknown }).items;
  let lines: QuoteLine[] = [];
  let estimatedTotal: number | null = null;
  let discountPercent: number | null = null;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const ids = rawItems.map((i) => (i as { productId?: unknown })?.productId).filter((v): v is string => typeof v === 'string');
    const [products, settings] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, price: true, discountPercent: true, sizes: { select: { size: true } } },
      }),
      prisma.settings.findUnique({ where: { id: 1 }, select: { wholesaleTiers: true } }),
    ]);
    const priced = priceWholesaleItems(
      rawItems,
      products.map((p) => ({ ...p, sizes: p.sizes.map((s) => s.size) })),
      parseTiers(settings?.wholesaleTiers ?? null),
    );
    if (!priced.ok) return res.status(400).json({ error: priced.error });
    lines = priced.lines;
    estimatedTotal = priced.total;
    discountPercent = priced.discountPercent;
    q.estimatedPieces = priced.pieces;
  }

  await prisma.wholesaleQuote.create({
    data: {
      name: q.name,
      company: q.company,
      cnpj: q.cnpj,
      phone: q.phone,
      email: q.email,
      city: q.city,
      state: q.state,
      interests: q.interests.join(','),
      estimatedPieces: q.estimatedPieces,
      message: q.message || null,
      ...(lines.length > 0 ? { items: lines as unknown as Prisma.InputJsonValue, estimatedTotal, discountPercent } : {}),
    },
  });
  void notifyWholesaleQuote(q, { lines, estimatedTotal, discountPercent });
  res.status(201).json({ ok: true });
});

// Dados pessoais de clientes: só administradores.
wholesaleRouter.get('/quotes', requireAdmin, async (_req, res) => {
  const quotes = await prisma.wholesaleQuote.findMany({
    orderBy: [{ handled: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
  res.json(quotes.map(serialize));
});

wholesaleRouter.patch('/quotes/:id', requireAdmin, async (req, res) => {
  const { handled } = req.body as { handled?: unknown };
  if (typeof handled !== 'boolean') return res.status(400).json({ error: 'Informe handled como true ou false.' });
  try {
    const quote = await prisma.wholesaleQuote.update({ where: { id: req.params.id as string }, data: { handled } });
    res.json(serialize(quote));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    throw err;
  }
});
