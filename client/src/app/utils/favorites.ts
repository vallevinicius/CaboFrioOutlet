export const FAVORITES_KEY = 'cabo-frio-outlet:favorites';
export const MAX_FAVORITES = 200;

/** Lê o JSON salvo no navegador; qualquer coisa fora do esperado vira lista vazia. */
export function parseStoredFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids = parsed.filter((v): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v));
    return [...new Set(ids)].slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

/** Adiciona (no início) ou remove o id. Não altera a lista original. */
export function toggleId(ids: string[], id: string): { ids: string[]; added: boolean } {
  if (ids.includes(id)) return { ids: ids.filter((i) => i !== id), added: false };
  return { ids: [id, ...ids].slice(0, MAX_FAVORITES), added: true };
}
