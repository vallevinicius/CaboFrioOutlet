export const MAX_FAVORITES = 200;

/** Limpa uma lista de IDs de produto (guest → conta). Retorna null se inválida. */
export function normalizeProductIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_FAVORITES) return null;
  const ids = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const id = item.trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
    ids.add(id);
  }
  return [...ids];
}
