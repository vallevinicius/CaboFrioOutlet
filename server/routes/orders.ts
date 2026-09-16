import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAdmin, requireAuth, optionalAuth } from '../middleware/auth';
import { expireStaleOrders } from '../services/stock';
import { calculateShippingOptions, ShippingPackageInput } from '../services/melhor-envio';

export const ordersRouter = Router();

interface OrderItemInput {
  productId: string;
  size: string;
  quantity: number;
}

interface ShippingAddressInput {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

const VALID_STATUSES = ['pendente', 'confirmado', 'enviado', 'entregue', 'cancelado'];

ordersRouter.get('/', requireAdmin, async (_req, res) => {
  await expireStaleOrders();
  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
});

// Pedidos do cliente logado (usados na tela "Meus pedidos").
ordersRouter.get('/mine', requireAuth, async (req, res) => {
  await expireStaleOrders();
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.sub },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
});

// Cria o pedido, calcula os preços a partir do catálogo (nunca confia no preço enviado
// pelo cliente) e baixa o estoque de forma atômica — se faltar estoque, tudo é revertido.
// Aceita tanto clientes logados (o pedido fica vinculado à conta) quanto visitantes.
ordersRouter.post('/', optionalAuth, async (req, res) => {
  const { customerName, customerContact, items, shippingAddress, shippingOptionId } = req.body as {
    customerName?: string;
    customerContact?: string;
    items?: OrderItemInput[];
    shippingAddress?: ShippingAddressInput;
    shippingOptionId?: number;
  };

  if (!customerName?.trim() || !customerContact?.trim() || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Preencha nome, contato e ao menos um item.' });
  }
  const cepDigits = shippingAddress?.cep?.replace(/\D/g, '') ?? '';
  if (
    cepDigits.length !== 8 ||
    !shippingAddress?.street?.trim() ||
    !shippingAddress.number?.trim() ||
    !shippingAddress.neighborhood?.trim() ||
    !shippingAddress.city?.trim() ||
    !shippingAddress.state?.trim()
  ) {
    return res.status(400).json({ error: 'Preencha o endereço de entrega completo.' });
  }

  try {
    const { order, subtotal, packages } = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const orderItemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];
      const packages: ShippingPackageInput[] = [];

      for (const item of items) {
        const { productId, size, quantity } = item;
        if (!productId || !size || !quantity || quantity <= 0) {
          throw new Error('Item de pedido inválido.');
        }

        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) {
          throw new Error('Um dos produtos do carrinho não existe mais.');
        }

        const productSize = await tx.productSize.findUnique({
          where: { productId_size: { productId, size } },
        });
        if (!productSize || productSize.stock < quantity) {
          throw new Error(`Estoque insuficiente para "${product.name}" (tamanho ${size}).`);
        }

        await tx.productSize.update({
          where: { id: productSize.id },
          data: { stock: { decrement: quantity } },
        });

        const unitPrice = product.discountPercent
          ? product.price * (1 - product.discountPercent / 100)
          : product.price;
        subtotal += unitPrice * quantity;

        orderItemsData.push({
          product: { connect: { id: product.id } },
          productName: product.name,
          image: product.image,
          size,
          quantity,
          unitPrice,
        });
        packages.push({
          productId: product.id,
          weightKg: product.weightKg,
          heightCm: product.heightCm,
          widthCm: product.widthCm,
          lengthCm: product.lengthCm,
          quantity,
          unitPrice,
        });
      }

      const order = await tx.order.create({
        data: {
          customerName: customerName.trim(),
          customerContact: customerContact.trim(),
          total: subtotal,
          status: 'pendente',
          items: { create: orderItemsData },
          userId: req.user?.sub,
          shippingCep: cepDigits,
          shippingStreet: shippingAddress.street!.trim(),
          shippingNumber: shippingAddress.number!.trim(),
          shippingComplement: shippingAddress.complement?.trim() || null,
          shippingNeighborhood: shippingAddress.neighborhood!.trim(),
          shippingCity: shippingAddress.city!.trim(),
          shippingState: shippingAddress.state!.trim().toUpperCase(),
        },
      });

      return { order, subtotal, packages };
    });

    // Calculada fora da transação: é uma chamada de rede pra Melhor Envio, não
    // deve segurar o lock do banco. Se falhar, cai no frete fixo — nunca deixa
    // o pedido travado por causa da integração de frete.
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, announcementMessages: '[]', brands: '[]' },
    });

    let shippingCost = subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
    let shippingService: string | null = 'Frete padrão';

    try {
      const options = await calculateShippingOptions(cepDigits, packages);
      if (options && options.length > 0) {
        const chosen = options.find((o) => o.id === shippingOptionId) ?? options[0];
        shippingService = chosen.name;
        shippingCost = subtotal >= settings.freeShippingThreshold ? 0 : chosen.price;
      }
    } catch (err) {
      console.error('Erro ao calcular frete, usando valor fixo:', err);
    }

    const finalOrder = await prisma.order.update({
      where: { id: order.id },
      data: { total: subtotal + shippingCost, shippingCost, shippingService },
      include: { items: true },
    });

    res.status(201).json(finalOrder);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar o pedido.';
    res.status(400).json({ error: message });
  }
});

ordersRouter.patch('/:id/status', requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const { status } = req.body as { status?: string };

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
    res.json(order);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    throw err;
  }
});
