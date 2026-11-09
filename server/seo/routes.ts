import { Router, Request, Response } from 'express';
import fs from 'fs';
import { prisma } from '../db';
import { parseOpeningHours } from '../utils/contact';
import {
  SeoProduct,
  buildRobotsTxt,
  buildSeoHead,
  buildSitemapXml,
  injectSeo,
  resolveBaseUrl,
} from './meta';

export const seoRouter = Router();

const baseUrlOf = (req: Request) => resolveBaseUrl(process.env.SITE_URL, req.protocol, req.get('host'));

seoRouter.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(buildRobotsTxt(baseUrlOf(req)));
});

seoRouter.get('/sitemap.xml', async (req, res) => {
  const products = await prisma.product.findMany({ select: { id: true, updatedAt: true }, take: 5000 });
  res.type('application/xml').send(buildSitemapXml(baseUrlOf(req), products));
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
      html = injectSeo(html, buildSeoHead({ baseUrl: baseUrlOf(req), path, settings, product }));
    } catch (err) {
      // SEO é um extra: se o banco falhar, ainda entregamos o app normalmente.
      console.error('Falha ao montar SEO:', err instanceof Error ? err.message : err);
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  };
}
