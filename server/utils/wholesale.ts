import { isValidCnpj, normalizeCnpj } from './cnpj';
import { normalizeEmail, normalizeWhatsapp } from './contact';

export const QUOTE_CATEGORIES = ['camisas', 'calças', 'bermudas', 'bonés'] as const;
export const DEFAULT_MIN_PIECES = 10;
export const DEFAULT_WHOLESALE_NOTES = [
  'Pode misturar modelos, marcas e tamanhos para chegar ao pedido mínimo.',
  'Condições de pagamento e entrega combinadas no orçamento.',
  'Atendimento direto com a loja, sem intermediários.',
].join('\n');

const MAX_NOTES_LENGTH = 1500;
const STATE_RE = /^[A-Z]{2}$/;

export interface QuoteInput {
  name: string;
  company: string;
  cnpj: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  interests: string[];
  estimatedPieces: number | null;
  message: string;
}

export type QuoteResult = { ok: true; value: QuoteInput } | { ok: false; error: string };

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const text = v.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : null;
};

/** Pedido mínimo: inteiro de 1 a 10000. Retorna null se inválido. */
export function normalizeMinPieces(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 10000 ? raw : null;
}

/** Condições (uma por linha). Vazio é válido (volta ao padrão). Retorna null se longo demais ou não for texto. */
export function normalizeWholesaleNotes(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const notes = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return notes.length <= MAX_NOTES_LENGTH ? notes : null;
}

export function validateQuote(raw: unknown): QuoteResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Preencha o formulário.' };
  const b = raw as Record<string, unknown>;

  const name = clean(b.name, 80);
  if (!name || name.length < 2) return { ok: false, error: 'Informe seu nome.' };

  const company = clean(b.company ?? '', 80);
  if (company === null) return { ok: false, error: 'Nome da loja muito longo.' };

  let cnpj = '';
  if (typeof b.cnpj === 'string' && b.cnpj.trim() !== '') {
    cnpj = normalizeCnpj(b.cnpj);
    if (!isValidCnpj(cnpj)) return { ok: false, error: 'CNPJ inválido. Confira os números ou deixe em branco.' };
  }

  const phoneRaw = typeof b.phone === 'string' ? normalizeWhatsapp(b.phone) : null;
  if (!phoneRaw) return { ok: false, error: 'Informe um WhatsApp ou telefone válido, com DDD.' };

  const email = typeof b.email === 'string' ? normalizeEmail(b.email) : null;
  if (!email) return { ok: false, error: 'Informe um e-mail válido.' };

  const city = clean(b.city, 60);
  if (!city || city.length < 2) return { ok: false, error: 'Informe a cidade.' };

  const state = typeof b.state === 'string' ? b.state.trim().toUpperCase() : '';
  if (!STATE_RE.test(state)) return { ok: false, error: 'Informe a UF (ex: RJ).' };

  const interests: string[] = [];
  if (b.interests !== undefined) {
    if (!Array.isArray(b.interests)) return { ok: false, error: 'Categorias inválidas.' };
    for (const i of b.interests) {
      if (typeof i !== 'string' || !(QUOTE_CATEGORIES as readonly string[]).includes(i)) {
        return { ok: false, error: 'Categorias inválidas.' };
      }
      if (!interests.includes(i)) interests.push(i);
    }
  }

  let estimatedPieces: number | null = null;
  if (b.estimatedPieces !== undefined && b.estimatedPieces !== null && b.estimatedPieces !== '') {
    const n = Number(b.estimatedPieces);
    if (!Number.isInteger(n) || n < 1 || n > 100000) return { ok: false, error: 'Quantidade estimada inválida.' };
    estimatedPieces = n;
  }

  // Mensagem mantém quebras de linha; só limita o tamanho.
  const message = typeof b.message === 'string' ? b.message.replace(/\r\n?/g, '\n').trim() : '';
  if (message.length > 1000) return { ok: false, error: 'A mensagem pode ter até 1000 caracteres.' };

  if (b.consent !== true) return { ok: false, error: 'Aceite ser contatado para enviar o pedido.' };

  return { ok: true, value: { name, company, cnpj, phone: phoneRaw, email, city, state, interests, estimatedPieces, message } };
}

/** Campo-isca: humanos não preenchem. Se vier preenchido, é robô. */
export function isHoneypotFilled(raw: unknown): boolean {
  const v = (raw as { website?: unknown } | null)?.website;
  return typeof v === 'string' && v.trim() !== '';
}
