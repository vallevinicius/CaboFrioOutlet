export const MAX_SLUG_LENGTH = 60;

/**
 * Endereços que já são páginas do site: uma categoria com esse slug nunca seria alcançada
 * (as rotas fixas do Angular vêm antes da rota /:categoria).
 */
export const RESERVED_SLUGS = [
  'produtos',
  'produto',
  'admin',
  'checkout',
  'minha-conta',
  'favoritos',
  'atacado',
  'api',
  'uploads',
  'sobre-nos',
  'contato',
  'trabalhe-conosco',
  'trocas-e-devolucoes',
  'perguntas-frequentes',
  'guia-de-medidas',
] as const;

/** "Camisas Polo Ção" → "camisas-polo-cao". */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
}

/** Mensagem de erro em português, ou null se o slug pode virar categoria. */
export function validateSlug(slug: string): string | null {
  if (!slug) return 'Escolha um nome com letras ou números.';
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    return `O endereço /${slug} já é usado por outra página do site. Escolha outro nome.`;
  }
  return null;
}
