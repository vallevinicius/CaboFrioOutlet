export const MAX_EXTRA_IMAGES = 8;

/**
 * Valida a lista de fotos adicionais enviada pelo admin. Aceita apenas caminhos
 * de upload (/uploads/...) ou URLs http(s); remove vazios e repetidos.
 * Retorna null se o formato for inválido.
 */
export function normalizeImages(raw: unknown, cover?: string): string[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_EXTRA_IMAGES * 2) return null;
  const seen = new Set<string>(cover ? [cover] : []);
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const url = item.trim();
    if (url === '') continue;
    if (url.length > 191 || !/^(\/uploads\/|https?:\/\/)/i.test(url)) return null;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out.length > MAX_EXTRA_IMAGES ? null : out;
}
