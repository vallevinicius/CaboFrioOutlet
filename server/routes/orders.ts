import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { expireStaleOrders } from '../services/stock.js';
import { calculateShippingOptions, ShippingPackageInput } from '../services/melhor-envio.js';
import { requirePermission } from '../middleware/permissions.js';
import { discountedUnitPrice, parseTiers, tierFor } from '../utils/wholesale-pricing.js';
import { isValidCpf, normalizeCpf } from '../utils/cpf.js';
import { openCpf, sealCpf } from '../utils/cpf-vault.js';

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

/** O CPF fica cifrado no banco; para quem tem direito de ver (equipe ou o próprio cliente) sai só com números. */
function exposeOrder<T extends { customerCpf?: string | null }>(order: T): T {
  return order.customerCpf ? { ...order, customerCpf: openCpf(order.customerCpf) } : order;
}

// Só os campos do cadastro que a equipe precisa para atender o pedido (nunca a senha).
const ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  cpf: true,
  phone: true,
  cep: true,
  street: true,
  number: true,
  complement: true,
  neighborhood: true,
  city: true,
  state: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type AccountRow = Prisma.UserGetPayload<{ select: typeof ACCOUNT_SELECT }>;

/** DTO campo a campo: nada além disto sai na resposta, mesmo que a consulta devolva mais. */
function toAccountDto(a: AccountRow, linkedBy: 'account' | 'email') {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    cpf: openCpf(a.cpf),
    phone: a.phone,
    cep: a.cep,
    street: a.street,
    number: a.number,
    complement: a.complement,
    neighborhood: a.neighborhood,
    city: a.city,
    state: a.state,
    createdAt: a.createdAt,
    linkedBy,
  };
}

/**
 * Junta cada pedido ao cadastro do cliente: pela conta que fez o pedido ou, no pedido de visitante,
 * pela conta que tem o mesmo e-mail. O pedido em si não é alterado.
 */
async function attachAccounts<T extends { userId: string | null; customerContact: string; customerCpf?: string | null }>(orders: T[]) {
  const ids = [...new Set(orders.map((o) => o.userId).filter((v): v is string => Boolean(v)))];
  const emails = [...new Set(orders.filter((o) => !o.userId).map((o) => o.customerContact.trim().toLowerCase()))];
  if (ids.length === 0 && emails.length === 0) return orders.map((o) => ({ ...exposeOrder(o), account: null }));

  const accounts = await prisma.user.findMany({
    where: { OR: [...(ids.length ? [{ id: { in: ids } }] : []), ...(emails.length ? [{ email: { in: emails } }] : [])] },
    select: ACCOUNT_SELECT,
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const byEmail = new Map(accounts.map((a) => [a.email.toLowerCase(), a]));

  return orders.map((o) => {
    const found = o.userId ? byId.get(o.userId) : byEmail.get(o.customerContact.trim().toLowerCase());
    return {
      ...exposeOrder(o),
      account: found ? toAccountDto(found, o.userId ? 'account' : 'email') : null,
    };
  });
}

ordersRouter.get('/', requirePermission('pedidos', 'view'), async (_req, res) => {
  await expireStaleOrders();
  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(await attachAccounts(orders));
});

// Pedidos do cliente logado (usados na tela "Meus pedidos").
ordersRouter.get('/mine', requireAuth, async (req, res) => {
  await expireStaleOrders();
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.sub },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders.map(exposeOrder));
});

// Cria o pedido, calcula os preços a partir do catálogo (nunca confia no preço enviado
// pelo cliente) e baixa o estoque de forma atômica — se faltar estoque, tudo é revertido.
// Aceita tanto clientes logados (o pedido fica vinculado à conta) quanto visitantes.
ordersRouter.post('/', optionalAuth, async (req, res) => {
  const { customerName, customerContact, customerPhone, customerCpf, items, shippingAddress, shippingOptionId, wholesale } = req.body as {
    customerName?: string;
    customerContact?: string;
    customerPhone?: string;
    customerCpf?: string;
    items?: OrderItemInput[];
    shippingAddress?: ShippingAddressInput;
    shippingOptionId?: number;
    wholesale?: boolean;
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

  // Telefone e CPF do cliente ficam gravados no pedido. Quem está logado usa os dados do próprio
  // cadastro (o que o navegador enviar é ignorado); visitante precisa informar e passa por validação.
  const account = req.user ? await prisma.user.findUnique({ where: { id: req.user.sub }, select: { cpf: true, phone: true } }) : null;
  const accountPhone = (account?.phone ?? '').replace(/\D/g, '');
  const accountCpf = normalizeCpf(openCpf(account?.cpf));
  const phone = accountPhone.length >= 10 ? accountPhone : (customerPhone ?? '').replace(/\D/g, '');
  const cpf = isValidCpf(accountCpf) ? accountCpf : normalizeCpf(customerCpf ?? '');
  if (phone.length < 10 || phone.length > 13) {
    return res.status(400).json({ error: 'Informe um telefone/WhatsApp válido.' });
  }
  if (!isValidCpf(cpf)) {
    return res.status(400).json({ error: 'Informe um CPF válido.' });
  }

  // Formato dos itens validado antes de mexer em estoque (quantidade inteira e positiva).
  const shapeOk = items.every(
    (i) => i && typeof i.productId === 'string' && typeof i.size === 'string' && Number.isInteger(i.quantity) && i.quantity > 0,
  );
  if (!shapeOk) {
    return res.status(400).json({ error: 'Item de pedido inválido.' });
  }

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, announcementMessages: '[]', brands: '[]' },
  });

  // Pedido de atacado: o servidor confere o mínimo e define o desconto pela quantidade
  // total de peças. O cliente só diz que é atacado, nunca o percentual.
  const isWholesale = wholesale === true;
  const pieces = items.reduce((sum, i) => sum + i.quantity, 0);
  if (isWholesale && pieces < settings.wholesaleMinPieces) {
    return res.status(400).json({ error: `O pedido de atacado precisa de pelo menos ${settings.wholesaleMinPieces} peças.` });
  }
  const wholesalePercent = isWholesale ? (tierFor(parseTiers(settings.wholesaleTiers), pieces)?.discountPercent ?? 0) : 0;

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
        if (isWholesale && product.channel === 'RETAIL') {
          throw new Error(`"${product.name}" é vendido apenas no varejo.`);
        }
        if (!isWholesale && product.channel === 'WHOLESALE') {
          throw new Error(`"${product.name}" é vendido apenas no atacado.`);
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

        const basePrice = product.discountPercent
          ? product.price * (1 - product.discountPercent / 100)
          : product.price;
        const unitPrice = wholesalePercent > 0 ? discountedUnitPrice(basePrice, wholesalePercent) : basePrice;
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
          customerPhone: phone,
          customerCpf: sealCpf(cpf).cpf,
          total: subtotal,
          status: 'pendente',
          items: { create: orderItemsData },
          userId: req.user?.sub,
          isWholesale,
          wholesaleDiscountPercent: isWholesale && wholesalePercent > 0 ? wholesalePercent : null,
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

    res.status(201).json(exposeOrder(finalOrder));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar o pedido.';
    res.status(400).json({ error: message });
  }
});

ordersRouter.patch('/:id/status', requirePermission('pedidos', 'edit'), async (req, res) => {
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
    res.json(exposeOrder(order));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    throw err;
  }
});
