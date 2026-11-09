export interface OpeningHoursRow {
  label: string;
  hours: string;
}

export const DEFAULT_OPENING_HOURS: OpeningHoursRow[] = [
  { label: 'Segunda a sábado', hours: '09h às 19h' },
  { label: 'Domingo', hours: '09h às 14h' },
];

const MAX_HOURS_ROWS = 7;
const MAX_FIELD_LENGTH = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mantém só dígitos e garante o DDI 55. Vazio é válido (apaga o número). Retorna null se inválido. */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  const national = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (national.length < 10 || national.length > 11) return null;
  return `55${national}`;
}

/** E-mail em minúsculas. Vazio é válido (apaga o e-mail). Retorna null se inválido. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email === '') return '';
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

/** Valida e limpa as linhas de horário. Retorna null se o formato for inválido. */
export function normalizeOpeningHours(raw: unknown): OpeningHoursRow[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_HOURS_ROWS) return null;
  const rows: OpeningHoursRow[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const { label, hours } = item as Record<string, unknown>;
    if (typeof label !== 'string' || typeof hours !== 'string') return null;
    const row = { label: label.trim(), hours: hours.trim() };
    if (row.label === '' && row.hours === '') continue;
    if (row.label === '' || row.hours === '') return null;
    if (row.label.length > MAX_FIELD_LENGTH || row.hours.length > MAX_FIELD_LENGTH) return null;
    rows.push(row);
  }
  return rows;
}

/** Lê o JSON salvo no banco; se nulo ou corrompido, volta ao horário padrão. */
export function parseOpeningHours(stored: string | null): OpeningHoursRow[] {
  if (stored === null) return DEFAULT_OPENING_HOURS;
  try {
    return normalizeOpeningHours(JSON.parse(stored)) ?? DEFAULT_OPENING_HOURS;
  } catch {
    return DEFAULT_OPENING_HOURS;
  }
}

/** Place ID do Google: só letras, números, `_` e `-`. Vazio é válido. Retorna null se inválido. */
export function normalizePlaceId(raw: string): string | null {
  const id = raw.trim();
  if (id === '') return '';
  return /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : null;
}
