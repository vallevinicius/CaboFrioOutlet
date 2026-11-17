export interface PackageMeasures {
  weightKg: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
}

/** Medidas da peça já dobrada e embalada, por categoria (o dono ajusta por produto). Mesma tabela do painel. */
const DEFAULTS: Record<string, PackageMeasures> = {
  camisas: { weightKg: 0.3, heightCm: 4, widthCm: 25, lengthCm: 30 },
  calças: { weightKg: 0.7, heightCm: 6, widthCm: 28, lengthCm: 35 },
  bermudas: { weightKg: 0.4, heightCm: 5, widthCm: 26, lengthCm: 32 },
  bonés: { weightKg: 0.2, heightCm: 12, widthCm: 20, lengthCm: 25 },
};

export function packageDefaultsFor(category: string): PackageMeasures {
  return { ...(DEFAULTS[category] ?? DEFAULTS['camisas']) };
}

/** Limites aceitos pelos Correios para uma encomenda. */
export const MAX_WEIGHT_KG = 30;
export const MAX_SIDE_CM = 105;
