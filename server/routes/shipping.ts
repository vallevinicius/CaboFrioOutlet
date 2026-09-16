import { Router } from 'express';
import { prisma } from '../db';
import { calculateShippingOptions, ShippingOption } from '../services/melhor-envio';

export const shippingRouter = Router();

interface ShippingItemInput {
  productId: string;
  quantity: number;
}

// Calcula as opções de frete pro carrinho a partir do CEP de destino. Se a
// Melhor Envio não estiver configurada (sem token/CEP de origem no admin),
// cai automaticamente no frete fixo das configurações — a loja nunca fica
// sem conseguir vender por falta dessa integração.
shippingRouter.post('/calculate', async (req, res) => {
  const { cep, items } = req.body as { cep?: string; items?: ShippingItemInput[] };
  const cepDigits = cep?.replace(/\D/g, '') ?? '';

  if (cepDigits.length !== 8 || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Informe um CEP válido e ao menos um item.' });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });

  let subtotal = 0;
  const packages = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return null;
    const unitPrice = product.discountPercent
      ? product.price * (1 - product.discountPercent / 100)
      : product.price;
    subtotal += unitPrice * item.quantity;
    return {
      productId: product.id,
      weightKg: product.weightKg,
      heightCm: product.heightCm,
      widthCm: product.widthCm,
      lengthCm: product.lengthCm,
      quantity: item.quantity,
      unitPrice,
    };
  });

  if (packages.some((p) => p === null)) {
    return res.status(400).json({ error: 'Um dos produtos do carrinho não existe mais.' });
  }

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const freeThreshold = settings?.freeShippingThreshold ?? 299;
  const flatFee = settings?.shippingFee ?? 19.9;

  let options: ShippingOption[] | null = null;
  try {
    options = await calculateShippingOptions(
      cepDigits,
      packages as NonNullable<(typeof packages)[number]>[]
    );
  } catch (err) {
    console.error('Erro ao consultar frete na Melhor Envio:', err);
  }

  if (!options || options.length === 0) {
    const price = subtotal >= freeThreshold ? 0 : flatFee;
    return res.json({
      options: [{ id: 0, name: 'Frete padrão', price, deliveryTime: null, company: '' }],
      usedFallback: true,
    });
  }

  // Frete grátis acima do valor configurado também vale pra cotação real —
  // zera todas as opções (independente da transportadora escolhida).
  if (subtotal >= freeThreshold) {
    options = options.map((opt) => ({ ...opt, price: 0 }));
  }

  res.json({ options, usedFallback: false });
});
