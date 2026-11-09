import { Router } from 'express';
import { Prisma, Product, ProductImage, ProductSize } from '@prisma/client';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth';
import { normalizeImages } from '../utils/product-images';

export const productsRouter = Router();

type ProductWithSizes = Product & { sizes: ProductSize[]; images: ProductImage[] };

const INCLUDE = { sizes: true, images: { orderBy: { position: 'asc' as const } } };

function serializeProduct(product: ProductWithSizes) {
  const stock: Record<string, number> = {};
  const sizes: string[] = [];
  for (const s of product.sizes) {
    sizes.push(s.size);
    stock[s.size] = s.stock;
  }
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    category: product.category,
    brand: product.brand ?? undefined,
    image: product.image,
    images: product.images.map((i) => i.url),
    description: product.description,
    isNew: product.isNew,
    discountPercent: product.discountPercent ?? undefined,
    sizes,
    stock,
  };
}

interface ProductPayload {
  name: string;
  price: number;
  category: string;
  brand?: string;
  image: string;
  images?: string[];
  description: string;
  sizes: string[];
  stock: Record<string, number>;
  discountPercent?: number;
  isNew?: boolean;
}

function validatePayload(body: unknown): body is ProductPayload {
  const p = body as Partial<ProductPayload>;
  return Boolean(
    p &&
      typeof p.name === 'string' &&
      p.name.trim() &&
      typeof p.price === 'number' &&
      p.price > 0 &&
      typeof p.category === 'string' &&
      typeof p.image === 'string' &&
      p.image.trim() &&
      Array.isArray(p.sizes) &&
      p.sizes.length > 0 &&
      typeof p.stock === 'object'
  );
}

productsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    include: INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(products.map(serializeProduct));
});

productsRouter.post('/', requireAdmin, async (req, res) => {
  if (!validatePayload(req.body)) {
    return res.status(400).json({ error: 'Dados do produto inválidos.' });
  }
  const { name, price, category, brand, image, description, sizes, stock, discountPercent, isNew } = req.body as ProductPayload;
  const extraImages = normalizeImages((req.body as ProductPayload).images, image);
  if (extraImages === null) {
    return res.status(400).json({ error: 'Fotos adicionais inválidas (máximo de 8).' });
  }

  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      price,
      category,
      brand: brand?.trim() || null,
      image,
      description: description?.trim() ?? '',
      isNew: Boolean(isNew),
      discountPercent: discountPercent && discountPercent > 0 ? discountPercent : null,
      sizes: {
        create: sizes.map((size) => ({ size, stock: Math.max(0, stock[size] ?? 0) })),
      },
      images: { create: extraImages.map((url, position) => ({ url, position })) },
    },
    include: INCLUDE,
  });

  res.status(201).json(serializeProduct(product));
});

productsRouter.put('/:id', requireAdmin, async (req, res) => {
  if (!validatePayload(req.body)) {
    return res.status(400).json({ error: 'Dados do produto inválidos.' });
  }
  const id = req.params.id as string;
  const { name, price, category, brand, image, description, sizes, stock, discountPercent, isNew } = req.body as ProductPayload;
  const extraImages = normalizeImages((req.body as ProductPayload).images, image);
  if (extraImages === null) {
    return res.status(400).json({ error: 'Fotos adicionais inválidas (máximo de 8).' });
  }

  try {
    await prisma.$transaction([
      prisma.productImage.deleteMany({ where: { productId: id } }),
      prisma.productImage.createMany({ data: extraImages.map((url, position) => ({ url, position, productId: id })) }),
      prisma.productSize.deleteMany({ where: { productId: id, size: { notIn: sizes } } }),
      ...sizes.map((size) =>
        prisma.productSize.upsert({
          where: { productId_size: { productId: id, size } },
          update: { stock: Math.max(0, stock[size] ?? 0) },
          create: { productId: id, size, stock: Math.max(0, stock[size] ?? 0) },
        })
      ),
      prisma.product.update({
        where: { id },
        data: {
          name: name.trim(),
          price,
          category,
          brand: brand?.trim() || null,
          image,
          description: description?.trim() ?? '',
          isNew: Boolean(isNew),
          discountPercent: discountPercent && discountPercent > 0 ? discountPercent : null,
        },
      }),
    ]);

    const product = await prisma.product.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    res.json(serializeProduct(product));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2025' || err.code === 'P2003')) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    throw err;
  }
});

productsRouter.put('/:id/stock', requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const { size, quantity } = req.body as { size?: string; quantity?: number };

  if (!size || typeof quantity !== 'number') {
    return res.status(400).json({ error: 'Informe tamanho e quantidade.' });
  }

  try {
    await prisma.productSize.upsert({
      where: { productId_size: { productId: id, size } },
      update: { stock: Math.max(0, quantity) },
      create: { productId: id, size, stock: Math.max(0, quantity) },
    });
    const product = await prisma.product.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    res.json(serializeProduct(product));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    throw err;
  }
});

productsRouter.delete('/:id', requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.product.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    throw err;
  }
});
