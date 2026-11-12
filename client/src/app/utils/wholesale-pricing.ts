import { WholesaleTier } from '../types/settings';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Maior faixa atingida com essa quantidade de peças (ou null). Mesma regra do servidor. */
export function tierFor(tiers: WholesaleTier[], pieces: number): WholesaleTier | null {
  let found: WholesaleTier | null = null;
  for (const t of tiers) if (pieces >= t.minPieces && (!found || t.minPieces > found.minPieces)) found = t;
  return found;
}

/** Próxima faixa ainda não atingida (a de menor quantidade acima da atual). */
export function nextTier(tiers: WholesaleTier[], pieces: number): WholesaleTier | null {
  let found: WholesaleTier | null = null;
  for (const t of tiers) if (t.minPieces > pieces && (!found || t.minPieces < found.minPieces)) found = t;
  return found;
}

/** Preço unitário com o desconto aplicado, arredondado em centavos (igual ao servidor). */
export function discountedUnitPrice(price: number, percent: number): number {
  return round2(price * (1 - percent / 100));
}

export interface WholesaleLine {
  /** Preço atual do produto (já com a promoção própria). */
  price: number;
  quantity: number;
}

export interface WholesaleSummary {
  pieces: number;
  percent: number;
  /** Soma sem o desconto de atacado. */
  subtotal: number;
  /** Quanto o desconto de atacado abate. */
  discountValue: number;
  total: number;
  meetsMin: boolean;
  missingForMin: number;
  next: { tier: WholesaleTier; missing: number } | null;
}

export function summarizeWholesale(lines: WholesaleLine[], tiers: WholesaleTier[], minPieces: number): WholesaleSummary {
  const pieces = lines.reduce((s, l) => s + l.quantity, 0);
  const percent = tierFor(tiers, pieces)?.discountPercent ?? 0;
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.quantity, 0));
  const total = round2(lines.reduce((s, l) => s + discountedUnitPrice(l.price, percent) * l.quantity, 0));
  const next = nextTier(tiers, pieces);
  return {
    pieces,
    percent,
    subtotal,
    discountValue: round2(subtotal - total),
    total,
    meetsMin: pieces >= minPieces,
    missingForMin: Math.max(0, minPieces - pieces),
    next: next ? { tier: next, missing: next.minPieces - pieces } : null,
  };
}

/** Maior desconto entre as faixas (0 se não houver faixas). Usado nos destaques da loja. */
export function maxDiscount(tiers: WholesaleTier[]): number {
  return tiers.reduce((max, t) => Math.max(max, t.discountPercent), 0);
}

/** Mostra 5 como "5" e 7.5 como "7,5" (sem zeros sobrando). */
export function formatPercent(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}
