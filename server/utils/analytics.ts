/** ID de medição do GA4: "G-" + letras/números. Vazio é válido (desliga). Retorna null se inválido. */
export function normalizeGaId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim().toUpperCase();
  if (id === '') return '';
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

/** ID do Pixel da Meta: só dígitos (8 a 20). Vazio é válido (desliga). Retorna null se inválido. */
export function normalizeMetaPixelId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  if (id === '') return '';
  return /^\d{8,20}$/.test(id) ? id : null;
}
