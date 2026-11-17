import { Router } from 'express';
import { Prisma, Product, ProductImage, ProductSize } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.js';
import { normalizeImages } from '../utils/product-images.js';
import { MAX_SIDE_CM, MAX_WEIGHT_KG, packageDefaultsFor } from '../utils/package-defaults.js';

export const productsRouter = Router();

type ProductWithSizes = Product & { sizes: ProductSize[]; images: ProductImage[] };

/** Limite do nome de um tamanho (P, GG, 42, "2 / 3"...). */
const MAX_SIZE_LENGTH = 20;

/** Onde a peça é vendida: na API em minúsculas, no banco como enum. */
const CHANNEL_TO_DB = { retail: 'RETAIL', wholesale: 'WHOLESALE', both: 'BOTH' } as const;
type ApiChannel = keyof typeof CHANNEL_TO_DB;
const CHANNEL_FROM_DB = { RETAIL: 'retail', WHOLESALE: 'wholesale', BOTH: 'both' } as const;

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
    channel: CHANNEL_FROM_DB[product.channel],
    weightKg: product.weightKg,
    heightCm: product.heightCm,
    widthCm: product.widthCm,
    lengthCm: product.lengthCm,
    sizes,
    stock,
  };
}

interface ProductPayload {
  channel?: ApiChannel;
  weightKg?: number;
  heightCm?: number;
  widthCm?: number;
  lengthCm?: number;
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

/** Peso e medidas são opcionais; quando vêm, precisam ser números dentro dos limites dos Correios. */
function validMeasures(p: Partial<ProductPayload>): boolean {
  const inRange = (value: unknown, max: number) => value === undefined || (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max);
  return inRange(p.weightKg, MAX_WEIGHT_KG) && inRange(p.heightCm, MAX_SIDE_CM) && inRange(p.widthCm, MAX_SIDE_CM) && inRange(p.lengthCm, MAX_SIDE_CM);
}

type MeasuresInput = { weightKg?: number; heightCm?: number; widthCm?: number; lengthCm?: number };

/** Produto novo: o que foi informado vale; o que faltou recebe o padrão da categoria. */
function packageMeasures(category: string, given: MeasuresInput) {
  return { ...packageDefaultsFor(category), ...definedMeasures(given) };
}

function definedMeasures(m: MeasuresInput): MeasuresInput {
  return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined));
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
      typeof p.stock === 'object' &&
      (p.channel === undefined || (typeof p.channel === 'string' && p.channel in CHANNEL_TO_DB)) &&
      validMeasures(p)
  );
}

productsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    include: INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(products.map(serializeProduct));
});

productsRouter.post('/', requirePermission('produtos', 'edit'), async (req, res) => {
  if (!validatePayload(req.body)) {
    return res.status(400).json({ error: 'Dados do produto inválidos.' });
  }
  const { name, price, category, brand, image, description, sizes, stock, discountPercent, isNew, channel, weightKg, heightCm, widthCm, lengthCm } = req.body as ProductPayload;
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
      channel: CHANNEL_TO_DB[channel ?? 'both'],
      ...packageMeasures(category, { weightKg, heightCm, widthCm, lengthCm }),
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

productsRouter.put('/:id', requirePermission('produtos', 'edit'), async (req, res) => {
  if (!validatePayload(req.body)) {
    return res.status(400).json({ error: 'Dados do produto inválidos.' });
  }
  const id = req.params.id as string;
  const { name, price, category, brand, image, description, sizes, stock, discountPercent, isNew, channel, weightKg, heightCm, widthCm, lengthCm } = req.body as ProductPayload;
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
          // Sem canal no corpo = não mexe (clientes antigos não zeram o canal sem querer).
          ...(channel !== undefined ? { channel: CHANNEL_TO_DB[channel] } : {}),
          // Sem medidas no corpo = não mexe nas que já existem.
          ...definedMeasures({ weightKg, heightCm, widthCm, lengthCm }),
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

productsRouter.put('/:id/stock', requireAnyPermission(['estoque', 'edit'], ['produtos', 'edit']), async (req, res) => {
  const id = req.params.id as string;
  const { size, quantity } = req.body as { size?: string; quantity?: number };

  if (!size || typeof quantity !== 'number') {
    return res.status(400).json({ error: 'Informe tamanho e quantidade.' });
  }
  if (size.length > MAX_SIZE_LENGTH) {
    return res.status(400).json({ error: `O tamanho deve ter no máximo ${MAX_SIZE_LENGTH} caracteres.` });
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

/** Remove um tamanho do produto. Pedidos antigos guardam o tamanho como texto, então não são afetados. */
productsRouter.delete('/:id/stock/:size', requireAnyPermission(['estoque', 'edit'], ['produtos', 'edit']), async (req, res) => {
  const id = req.params.id as string;
  const size = req.params.size as string;

  const outcome = await prisma.$transaction(async (tx) => {
    if (!(await tx.product.findUnique({ where: { id }, select: { id: true } }))) return 'no-product' as const;
    const sizes = await tx.productSize.findMany({ where: { productId: id }, select: { size: true } });
    if (!sizes.some((s) => s.size === size)) return 'no-size' as const;
    if (sizes.length <= 1) return 'last-size' as const;
    await tx.productSize.delete({ where: { productId_size: { productId: id, size } } });
    return tx.product.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  });

  if (outcome === 'no-product') return res.status(404).json({ error: 'Produto não encontrado.' });
  if (outcome === 'no-size') return res.status(404).json({ error: 'Tamanho não encontrado neste produto.' });
  if (outcome === 'last-size') return res.status(409).json({ error: 'O produto precisa ter ao menos um tamanho.' });
  res.json(serializeProduct(outcome));
});

productsRouter.delete('/:id', requirePermission('produtos', 'edit'), async (req, res) => {
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
