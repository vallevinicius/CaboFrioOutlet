export interface TrackItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  brand?: string;
  size?: string;
}

export interface TrackedEvent {
  ga: { name: string; params: Record<string, unknown> };
  meta: { name: string; params: Record<string, unknown> };
}

const CURRENCY = 'BRL';
const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (items: TrackItem[]) => round2(items.reduce((t, i) => t + i.price * i.quantity, 0));

function gaItem(i: TrackItem) {
  return {
    item_id: i.id,
    item_name: i.name,
    price: round2(i.price),
    quantity: i.quantity,
    ...(i.category ? { item_category: i.category } : {}),
    ...(i.brand ? { item_brand: i.brand } : {}),
    ...(i.size ? { item_variant: i.size } : {}),
  };
}

function metaBase(items: TrackItem[]) {
  return {
    content_ids: items.map((i) => i.id),
    content_type: 'product',
    value: sum(items),
    currency: CURRENCY,
  };
}

export function buildViewItem(item: TrackItem): TrackedEvent {
  return {
    ga: { name: 'view_item', params: { currency: CURRENCY, value: sum([item]), items: [gaItem(item)] } },
    meta: { name: 'ViewContent', params: { ...metaBase([item]), content_name: item.name } },
  };
}

export function buildAddToCart(item: TrackItem): TrackedEvent {
  return {
    ga: { name: 'add_to_cart', params: { currency: CURRENCY, value: sum([item]), items: [gaItem(item)] } },
    meta: { name: 'AddToCart', params: { ...metaBase([item]), content_name: item.name } },
  };
}

export function buildBeginCheckout(items: TrackItem[]): TrackedEvent {
  return {
    ga: { name: 'begin_checkout', params: { currency: CURRENCY, value: sum(items), items: items.map(gaItem) } },
    meta: {
      name: 'InitiateCheckout',
      params: { ...metaBase(items), num_items: items.reduce((t, i) => t + i.quantity, 0) },
    },
  };
}

/** `total` e `shipping` vêm do pedido; o valor de itens é recalculado só para o GA4 listar os produtos. */
export function buildPurchase(orderId: string, items: TrackItem[], total: number, shipping: number): TrackedEvent {
  return {
    ga: {
      name: 'purchase',
      params: {
        transaction_id: orderId,
        currency: CURRENCY,
        value: round2(total),
        shipping: round2(shipping),
        items: items.map(gaItem),
      },
    },
    meta: {
      name: 'Purchase',
      params: {
        content_ids: items.map((i) => i.id),
        content_type: 'product',
        value: round2(total),
        currency: CURRENCY,
        num_items: items.reduce((t, i) => t + i.quantity, 0),
      },
    },
  };
}

export type Consent = 'granted' | 'denied';

/** Só aceita os dois valores conhecidos; qualquer outra coisa conta como "ainda não decidiu". */
export function parseConsent(raw: string | null): Consent | null {
  return raw === 'granted' || raw === 'denied' ? raw : null;
}
