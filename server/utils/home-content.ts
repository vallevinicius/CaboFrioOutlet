export const DEFAULT_TICKER_MESSAGES = [
  'Multimarcas',
  '10 anos em Cabo Frio',
  'Roupa de rua com preço de outlet',
  'Troca grátis em 30 dias',
];

export const DEFAULT_STORY_TITLE = '10 anos vestindo Cabo Frio';
export const DEFAULT_STORY_BODY = [
  'A Cabo Frio Outlet começou como loja de bairro e cresceu junto com os clientes. Hoje reunimos as marcas que a rua usa, com preço de outlet e atendimento de quem entende do assunto.',
  'Compre pelo site ou passe na loja para experimentar as peças e levar o look na hora.',
].join('\n\n');

const MAX_TICKER_ITEMS = 8;
const MAX_TICKER_LENGTH = 60;
const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 1200;

/** Limpa a lista da faixa: sem vazios nem repetidos. Retorna null se o formato for inválido. */
export function normalizeTickerMessages(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_TICKER_ITEMS * 2) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const text = item.replace(/\s+/g, ' ').trim();
    if (text === '') continue;
    if (text.length > MAX_TICKER_LENGTH) return null;
    if (seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out.length > MAX_TICKER_ITEMS ? null : out;
}

/** Lê o JSON salvo; nulo ou corrompido volta ao padrão. Lista vazia é válida (faixa oculta). */
export function parseTickerMessages(stored: string | null): string[] {
  if (stored === null) return DEFAULT_TICKER_MESSAGES;
  try {
    return normalizeTickerMessages(JSON.parse(stored)) ?? DEFAULT_TICKER_MESSAGES;
  } catch {
    return DEFAULT_TICKER_MESSAGES;
  }
}

/** Título em uma linha. Vazio é válido (volta ao padrão). Retorna null se longo demais ou não for texto. */
export function normalizeStoryTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const title = raw.replace(/\s+/g, ' ').trim();
  return title.length <= MAX_TITLE_LENGTH ? title : null;
}

/** Texto com parágrafos separados por linha em branco. Vazio é válido (volta ao padrão). */
export function normalizeStoryBody(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const body = raw
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
  return body.length <= MAX_BODY_LENGTH ? body : null;
}
