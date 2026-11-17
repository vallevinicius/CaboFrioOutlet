export interface PackageMeasures {
  weightKg: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
}

/** Peça já dobrada e embalada, por categoria. Mesma tabela do servidor (server/utils/package-defaults.ts). */
const DEFAULTS: Record<string, PackageMeasures> = {
  camisas: { weightKg: 0.3, heightCm: 4, widthCm: 25, lengthCm: 30 },
  calças: { weightKg: 0.7, heightCm: 6, widthCm: 28, lengthCm: 35 },
  bermudas: { weightKg: 0.4, heightCm: 5, widthCm: 26, lengthCm: 32 },
  bonés: { weightKg: 0.2, heightCm: 12, widthCm: 20, lengthCm: 25 },
};

export function packageDefaultsFor(category: string): PackageMeasures {
  return { ...(DEFAULTS[category] ?? DEFAULTS['camisas']) };
}

/** Limites aceitos pelos Correios. */
export const MAX_WEIGHT_KG = 30;
export const MAX_SIDE_CM = 105;

/** Texto digitado ("0,35") → número válido (maior que zero e até o limite) ou null. */
export function parseMeasure(raw: string, max: number): number | null {
  const text = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return value > 0 && value <= max ? value : null;
}
