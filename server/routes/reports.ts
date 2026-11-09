import { Router } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth';
import { buildLowStock, buildOverview, parsePeriod } from '../services/reports';

export const reportsRouter = Router();

// Dados de venda e estoque: só administradores.
reportsRouter.get('/overview', requireAdmin, async (req, res) => {
  const days = parsePeriod(req.query.days);
  const since = new Date(Date.now() - (days + 1) * 24 * 60 * 60 * 1000);

  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        status: true,
        total: true,
        items: { select: { productId: true, productName: true, quantity: true, unitPrice: true } },
      },
      take: 5000,
    }),
    prisma.product.findMany({
      select: { id: true, name: true, sizes: { select: { size: true, stock: true } } },
    }),
  ]);

  res.json({
    overview: buildOverview(orders, days),
    lowStock: buildLowStock(products),
  });
});
