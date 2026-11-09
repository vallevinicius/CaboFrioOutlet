import { Router } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth';
import {
  normalizeEmail,
  normalizeOpeningHours,
  normalizePlaceId,
  normalizeWhatsapp,
  parseOpeningHours,
} from '../utils/contact';

import {
  DEFAULT_STORY_BODY,
  DEFAULT_STORY_TITLE,
  normalizeStoryBody,
  normalizeStoryTitle,
  normalizeTickerMessages,
  parseTickerMessages,
} from '../utils/home-content';

import { normalizeGaId, normalizeMetaPixelId } from '../utils/analytics';

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
  whatsapp: string;
  contactEmail: string;
  openingHours: string | null;
  googlePlaceId: string;
  tickerMessages: string | null;
  storyTitle: string;
  storyBody: string | null;
  gaMeasurementId: string;
  metaPixelId: string;
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
    whatsapp: settings.whatsapp,
    contactEmail: settings.contactEmail,
    openingHours: parseOpeningHours(settings.openingHours),
    googlePlaceId: settings.googlePlaceId,
    tickerMessages: parseTickerMessages(settings.tickerMessages),
    storyTitle: settings.storyTitle || DEFAULT_STORY_TITLE,
    storyBody: settings.storyBody || DEFAULT_STORY_BODY,
    gaMeasurementId: settings.gaMeasurementId,
    metaPixelId: settings.metaPixelId,
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
    whatsapp,
    contactEmail,
    openingHours,
    googlePlaceId,
    tickerMessages,
    storyTitle,
    storyBody,
    gaMeasurementId,
    metaPixelId,
  } = req.body as {
    storeName?: string;
    freeShippingThreshold?: number;
    shippingFee?: number;
    originCep?: string;
    melhorEnvioToken?: string;
    melhorEnvioSandbox?: boolean;
    announcementMessages?: string[];
    brands?: string[];
    whatsapp?: string;
    contactEmail?: string;
    openingHours?: unknown;
    googlePlaceId?: string;
    tickerMessages?: unknown;
    storyTitle?: unknown;
    storyBody?: unknown;
    gaMeasurementId?: unknown;
    metaPixelId?: unknown;
  };

  const contact: {
    whatsapp?: string;
    contactEmail?: string;
    openingHours?: string;
    googlePlaceId?: string;
    tickerMessages?: string;
    storyTitle?: string;
    storyBody?: string | null;
    gaMeasurementId?: string;
    metaPixelId?: string;
  } = {};
  if (gaMeasurementId !== undefined) {
    const value = normalizeGaId(gaMeasurementId);
    if (value === null) return res.status(400).json({ error: 'ID do Google Analytics inválido (formato G-XXXXXXXXXX).' });
    contact.gaMeasurementId = value;
  }
  if (metaPixelId !== undefined) {
    const value = normalizeMetaPixelId(metaPixelId);
    if (value === null) return res.status(400).json({ error: 'ID do Pixel da Meta inválido (somente números).' });
    contact.metaPixelId = value;
  }
  if (tickerMessages !== undefined) {
    const value = normalizeTickerMessages(tickerMessages);
    if (value === null) return res.status(400).json({ error: 'Mensagens da faixa inválidas (até 8, com até 60 caracteres).' });
    contact.tickerMessages = JSON.stringify(value);
  }
  if (storyTitle !== undefined) {
    const value = normalizeStoryTitle(storyTitle);
    if (value === null) return res.status(400).json({ error: 'Título da história inválido (até 80 caracteres).' });
    contact.storyTitle = value;
  }
  if (storyBody !== undefined) {
    const value = normalizeStoryBody(storyBody);
    if (value === null) return res.status(400).json({ error: 'Texto da história inválido (até 1200 caracteres).' });
    contact.storyBody = value === '' ? null : value;
  }
  if (typeof whatsapp === 'string') {
    const value = normalizeWhatsapp(whatsapp);
    if (value === null) return res.status(400).json({ error: 'WhatsApp inválido. Use DDD + número.' });
    contact.whatsapp = value;
  }
  if (typeof contactEmail === 'string') {
    const value = normalizeEmail(contactEmail);
    if (value === null) return res.status(400).json({ error: 'E-mail de contato inválido.' });
    contact.contactEmail = value;
  }
  if (openingHours !== undefined) {
    const value = normalizeOpeningHours(openingHours);
    if (value === null) return res.status(400).json({ error: 'Horários inválidos.' });
    contact.openingHours = JSON.stringify(value);
  }
  if (typeof googlePlaceId === 'string') {
    const value = normalizePlaceId(googlePlaceId);
    if (value === null) return res.status(400).json({ error: 'Place ID do Google inválido.' });
    contact.googlePlaceId = value;
  }

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
      ...contact,
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
      ...contact,
    },
  });

  res.json(serialize(settings));
});
