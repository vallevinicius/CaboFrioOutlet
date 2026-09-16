import { Router } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth';

export const settingsRouter = Router();

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serialize(settings: {
  storeName: string;
  freeShippingThreshold: number;
  shippingFee: number;
  originCep: string;
  melhorEnvioToken: string | null;
  melhorEnvioSandbox: boolean;
  announcementMessages: string;
  brands: string;
}) {
  return {
    storeName: settings.storeName,
    freeShippingThreshold: settings.freeShippingThreshold,
    shippingFee: settings.shippingFee,
    originCep: settings.originCep,
    hasMelhorEnvioToken: Boolean(settings.melhorEnvioToken),
    melhorEnvioSandbox: settings.melhorEnvioSandbox,
    announcementMessages: parseJsonArray(settings.announcementMessages),
    brands: parseJsonArray(settings.brands),
  };
}

settingsRouter.get('/', async (_req, res) => {
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, announcementMessages: '[]', brands: '[]' },
  });
  res.json(serialize(settings));
});

settingsRouter.put('/', requireAdmin, async (req, res) => {
  const {
    storeName,
    freeShippingThreshold,
    shippingFee,
    originCep,
    melhorEnvioToken,
    melhorEnvioSandbox,
    announcementMessages,
    brands,
  } = req.body as {
    storeName?: string;
    freeShippingThreshold?: number;
    shippingFee?: number;
    originCep?: string;
    melhorEnvioToken?: string;
    melhorEnvioSandbox?: boolean;
    announcementMessages?: string[];
    brands?: string[];
  };

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      ...(storeName?.trim() ? { storeName: storeName.trim() } : {}),
      ...(typeof freeShippingThreshold === 'number' && freeShippingThreshold > 0
        ? { freeShippingThreshold }
        : {}),
      ...(typeof shippingFee === 'number' && shippingFee >= 0 ? { shippingFee } : {}),
      ...(typeof originCep === 'string' ? { originCep: originCep.replace(/\D/g, '') } : {}),
      // Só atualiza o token se um novo valor não-vazio foi enviado — o campo no admin
      // fica em branco (não mostra o valor salvo), então não sobrescreve com string vazia.
      ...(melhorEnvioToken?.trim() ? { melhorEnvioToken: melhorEnvioToken.trim() } : {}),
      ...(typeof melhorEnvioSandbox === 'boolean' ? { melhorEnvioSandbox } : {}),
      ...(Array.isArray(announcementMessages)
        ? { announcementMessages: JSON.stringify(announcementMessages) }
        : {}),
      ...(Array.isArray(brands) ? { brands: JSON.stringify(brands) } : {}),
    },
    create: {
      id: 1,
      storeName: storeName?.trim() || undefined,
      freeShippingThreshold: freeShippingThreshold || undefined,
      shippingFee: typeof shippingFee === 'number' && shippingFee >= 0 ? shippingFee : undefined,
      originCep: originCep?.replace(/\D/g, '') || undefined,
      melhorEnvioToken: melhorEnvioToken?.trim() || undefined,
      melhorEnvioSandbox: typeof melhorEnvioSandbox === 'boolean' ? melhorEnvioSandbox : undefined,
      announcementMessages: JSON.stringify(announcementMessages ?? []),
      brands: JSON.stringify(brands ?? []),
    },
  });

  res.json(serialize(settings));
});
