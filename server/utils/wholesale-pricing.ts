export interface Tier {
  minPieces: number;
  discountPercent: number;
}

export const DEFAULT_TIERS: Tier[] = [
  { minPieces: 10, discountPercent: 5 },
  { minPieces: 20, discountPercent: 10 },
  { minPieces: 50, discountPercent: 15 },
];

const MAX_TIERS = 8;
const MAX_PIECES = 100000;
const MAX_DISCOUNT = 90;
export const MAX_QUOTE_LINES = 200;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Valida as faixas enviadas pelo admin. Regras: até 8, quantidades inteiras e
 * únicas, desconto entre 0 e 90 (até 2 casas) e crescente — mais peças, mais
 * desconto. Devolve ordenado por quantidade, ou null se inválido.
 */
export function normalizeTiers(raw: unknown): Tier[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_TIERS) return null;
  const tiers: Tier[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const { minPieces, discountPercent } = item as Record<string, unknown>;
    if (typeof minPieces !== 'number' || !Number.isInteger(minPieces) || minPieces < 1 || minPieces > MAX_PIECES) return null;
    if (typeof discountPercent !== 'number' || !Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > MAX_DISCOUNT) return null;
    tiers.push({ minPieces, discountPercent: round2(discountPercent) });
  }
  tiers.sort((a, b) => a.minPieces - b.minPieces);
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].minPieces === tiers[i - 1].minPieces) return null; // quantidade repetida
    if (tiers[i].discountPercent <= tiers[i - 1].discountPercent) return null; // mais peças precisa dar mais desconto
  }
  return tiers;
}

/** Lê o JSON salvo; nulo ou corrompido volta ao padrão. Lista vazia é válida (sem desconto). */
export function parseTiers(stored: string | null): Tier[] {
  if (stored === null) return DEFAULT_TIERS;
  try {
    return normalizeTiers(JSON.parse(stored)) ?? DEFAULT_TIERS;
  } catch {
    return DEFAULT_TIERS;
  }
}

/** Maior faixa atingida com essa quantidade de peças (ou null). */
export function tierFor(tiers: Tier[], pieces: number): Tier | null {
  let found: Tier | null = null;
  for (const t of tiers) if (pieces >= t.minPieces && (!found || t.minPieces > found.minPieces)) found = t;
  return found;
}

/** Preço unitário com o desconto aplicado, arredondado em centavos. */
export function discountedUnitPrice(price: number, percent: number): number {
  return round2(price * (1 - percent / 100));
}

/** Preço atual do produto (já com a promoção própria, se houver). */
export function currentPrice(p: { price: number; discountPercent: number | null }): number {
  return p.discountPercent ? p.price * (1 - p.discountPercent / 100) : p.price;
}

export interface PricedProduct {
  id: string;
  name: string;
  price: number;
  discountPercent: number | null;
  sizes: string[];
}

export interface QuoteLine {
  productId: string;
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

export type PricedItems =
  | { ok: true; lines: QuoteLine[]; pieces: number; discountPercent: number; total: number }
  | { ok: false; error: string };

/**
 * Monta e precifica a lista de peças escolhidas no site. Os preços vêm SEMPRE
 * do catálogo (nada do que o navegador mandar sobre preço é usado).
 */
export function priceWholesaleItems(raw: unknown, products: PricedProduct[], tiers: Tier[]): PricedItems {
  if (!Array.isArray(raw)) return { ok: false, error: 'Lista de peças inválida.' };
  if (raw.length > MAX_QUOTE_LINES) return { ok: false, error: 'Peças demais no pedido.' };

  const byId = new Map(products.map((p) => [p.id, p]));
  const merged = new Map<string, { product: PricedProduct; size: string; quantity: number }>();
  let pieces = 0;

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return { ok: false, error: 'Peça inválida.' };
    const { productId, size, quantity } = item as Record<string, unknown>;
    if (typeof productId !== 'string' || typeof size !== 'string' || typeof quantity !== 'number') return { ok: false, error: 'Peça inválida.' };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PIECES) return { ok: false, error: 'Quantidade inválida.' };
    const product = byId.get(productId);
    if (!product) return { ok: false, error: 'Uma das peças não existe mais.' };
    if (!product.sizes.includes(size)) return { ok: false, error: `Tamanho inválido para "${product.name}".` };
    const key = `${productId}\u0000${size}`;
    const prev = merged.get(key);
    merged.set(key, { product, size, quantity: (prev?.quantity ?? 0) + quantity });
    pieces += quantity;
  }
  if (pieces > MAX_PIECES) return { ok: false, error: 'Quantidade total inválida.' };

  const percent = tierFor(tiers, pieces)?.discountPercent ?? 0;
  const lines: QuoteLine[] = [...merged.values()].map(({ product, size, quantity }) => ({
    productId: product.id,
    name: product.name,
    size,
    quantity,
    unitPrice: discountedUnitPrice(currentPrice(product), percent),
  }));
  const total = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  return { ok: true, lines, pieces, discountPercent: percent, total };
}
