/** A vitrine de marcas usa letras enormes: mais que isso ocuparia a tela toda. */
export const MAX_SHOWCASE_BRANDS = 12;

/** Mesma marca escrita diferente ("Nike", " NIKE ") vira a mesma chave. */
export function brandKey(brand: string | undefined): string {
  return (brand ?? '').trim().toLocaleLowerCase('pt-BR');
}

/**
 * Marcas da vitrine da home. A lista de Admin → Configurações tem prioridade; vazia, usa as
 * marcas dos produtos (sem repetir, da que tem mais peças para a que tem menos).
 */
export function showcaseBrands(configured: string[], products: { brand?: string }[]): string[] {
  if (configured.length > 0) return configured;

  const byKey = new Map<string, { name: string; count: number }>();
  for (const { brand } of products) {
    const name = brand?.trim();
    if (!name) continue;
    const key = brandKey(name);
    const entry = byKey.get(key);
    if (entry) entry.count++;
    else byKey.set(key, { name, count: 1 });
  }

  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, MAX_SHOWCASE_BRANDS)
    .map((b) => b.name);
}
