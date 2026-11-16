/** Mesmo limite do servidor (`MAX_SIZE_LENGTH` em server/routes/products.ts). */
export const MAX_SIZE_LENGTH = 20;

export type NewSizeCheck = { ok: true; size: string } | { ok: false; error: string };

/** Valida o nome digitado para um novo tamanho do produto. */
export function checkNewSize(existing: string[], raw: string): NewSizeCheck {
  const size = raw.trim().toUpperCase();
  if (!size) return { ok: false, error: 'Digite o tamanho (ex.: GG, 42).' };
  if (size.length > MAX_SIZE_LENGTH) return { ok: false, error: `O tamanho deve ter no máximo ${MAX_SIZE_LENGTH} caracteres.` };
  if (existing.some((s) => s.toUpperCase() === size)) return { ok: false, error: `O tamanho ${size} já existe neste produto.` };
  return { ok: true, size };
}
