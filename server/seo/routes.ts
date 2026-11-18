import { Router, Request, Response } from 'express';
import fs from 'fs';
import { prisma } from '../db.js';
import { parseOpeningHours } from '../utils/contact.js';
import { listActiveCategories } from '../routes/categories.js';
import {
  SeoProduct,
  buildRobotsTxt,
  buildSeoHead,
  buildSitemapXml,
  injectSeo,
  resolveBaseUrl,
} from './meta.js';

export const seoRouter = Router();

const baseUrlOf = (req: Request) => resolveBaseUrl(process.env.SITE_URL, req.protocol, req.get('host'));

seoRouter.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(buildRobotsTxt(baseUrlOf(req)));
});

seoRouter.get('/sitemap.xml', async (req, res) => {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { channel: { not: 'WHOLESALE' } }, select: { id: true, updatedAt: true }, take: 5000 }),
    listActiveCategories(),
  ]);
  res.type('application/xml').send(buildSitemapXml(baseUrlOf(req), products, categories));
});

async function loadProduct(id: string): Promise<SeoProduct | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      price: true,
      discountPercent: true,
      brand: true,
      sizes: { select: { stock: true } },
    },
  });
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    image: product.image,
    price: product.price,
    discountPercent: product.discountPercent,
    brand: product.brand,
    totalStock: product.sizes.reduce((sum, s) => sum + s.stock, 0),
  };
}

/** Só categorias ativas viram página; oculta ou inexistente cai no 404 do Angular. */
async function loadActiveCategory(slug: string) {
  const category = await prisma.category.findUnique({ where: { slug }, select: { name: true, description: true, active: true } });
  return category?.active ? { name: category.name, description: category.description } : null;
}

/** Entrega o index.html do Angular com as tags de SEO da rota já preenchidas. */
export function sendIndexWithSeo(indexPath: string) {
  return async (req: Request, res: Response) => {
    let html: string;
    try {
      html = await fs.promises.readFile(indexPath, 'utf8');
    } catch {
      return res.status(404).send('Build do client não encontrado. Rode "npm run build" primeiro.');
    }

    try {
      const settingsRow = await prisma.settings.findUnique({ where: { id: 1 } });
      const settings = {
        storeName: settingsRow?.storeName ?? 'Cabo Frio Outlet',
        whatsapp: settingsRow?.whatsapp ?? '',
        openingHours: parseOpeningHours(settingsRow?.openingHours ?? null),
      };
      const path = req.path.replace(/\/+$/, '') || '/';
      const productMatch = path.match(/^\/produto\/([A-Za-z0-9_-]{1,64})$/);
      const product = productMatch ? await loadProduct(productMatch[1]) : null;
      const slugMatch = path.match(/^\/([a-z0-9-]{1,60})$/);
      const category = slugMatch ? await loadActiveCategory(slugMatch[1]) : null;
      html = injectSeo(
        html,
        buildSeoHead({
          baseUrl: baseUrlOf(req),
          path,
          settings,
          product,
          category,
          siteVerification: process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined,
        }),
      );
    } catch (err) {
      // SEO é um extra: se o banco falhar, ainda entregamos o app normalmente.
      console.error('Falha ao montar SEO:', err instanceof Error ? err.message : err);
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  };
}
