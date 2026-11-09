import type { OpeningHoursRow } from '../utils/contact';

export interface SeoProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  discountPercent: number | null;
  brand: string | null;
  totalStock: number;
}

export interface SeoSettings {
  storeName: string;
  whatsapp: string;
  openingHours: OpeningHoursRow[];
}

export interface SeoContext {
  baseUrl: string;
  path: string;
  settings: SeoSettings;
  product?: SeoProduct | null;
}

export const STORE_ADDRESS = {
  streetAddress: 'Avenida Júlia Kubitschek, 16, Edifício Premier Center, lojas 3 e 4',
  addressLocality: 'Cabo Frio',
  addressRegion: 'RJ',
  postalCode: '28905-000',
  addressCountry: 'BR',
};
export const INSTAGRAM_URL = 'https://www.instagram.com/cabofrio.outlet';

const DEFAULT_DESCRIPTION =
  'Cabo Frio Outlet: vestuário urbano com preço de outlet. Camisas, calças, bermudas e bonés. Há 10 anos no Centro de Cabo Frio.';

/** Título e descrição das páginas institucionais (espelha as rotas do client). */
export const PAGE_META: Record<string, { title: string; description: string }> = {
  '/sobre-nos': {
    title: 'Sobre nós',
    description: 'Há 10 anos vestindo Cabo Frio com moda urbana e preço de outlet. Conheça a nossa história e venha nos visitar.',
  },
  '/contato': {
    title: 'Contato',
    description: 'Endereço, horário de funcionamento, WhatsApp e e-mail da Cabo Frio Outlet, no Centro de Cabo Frio.',
  },
  '/trabalhe-conosco': {
    title: 'Trabalhe conosco',
    description: 'Quer fazer parte do time da Cabo Frio Outlet? Veja como se candidatar.',
  },
  '/trocas-e-devolucoes': {
    title: 'Trocas e devoluções',
    description: 'Primeira troca grátis em até 30 dias. Conheça as condições de troca e devolução da Cabo Frio Outlet.',
  },
  '/perguntas-frequentes': {
    title: 'Perguntas frequentes',
    description: 'Tire dúvidas sobre pagamento, frete, trocas e tamanhos na Cabo Frio Outlet.',
  },
  '/guia-de-medidas': {
    title: 'Guia de medidas',
    description: 'Tabelas de medidas de camisas, calças, bermudas e bonés para escolher o tamanho certo.',
  },
};

/** Rotas que não devem ser indexadas (área privada ou transacional). */
export const NOINDEX_PREFIXES = ['/admin', '/checkout', '/minha-conta', '/favoritos'];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Serializa JSON-LD de forma segura dentro de <script> (evita fechar a tag com "</script>"). */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function absoluteUrl(baseUrl: string, urlOrPath: string): string {
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  return `${baseUrl}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
}

export function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function finalPrice(product: Pick<SeoProduct, 'price' | 'discountPercent'>): number {
  const value = product.discountPercent ? product.price * (1 - product.discountPercent / 100) : product.price;
  return Math.round(value * 100) / 100;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
// Só nomes de dia exatos (ou abreviações de 3 letras) — prefixo solto confundia "Quando" com "Quarta".
const DAY_ALIASES: [RegExp, number][] = [
  [/^(dom|domingo|domingos)$/, 0],
  [/^(seg|segunda|segundas)(-?feira)?$/, 1],
  [/^(ter|terca|tercas)(-?feira)?$/, 2],
  [/^(qua|quarta|quartas)(-?feira)?$/, 3],
  [/^(qui|quinta|quintas)(-?feira)?$/, 4],
  [/^(sex|sexta|sextas)(-?feira)?$/, 5],
  [/^(sab|sabado|sabados)$/, 6],
];

function dayIndex(word: string): number | null {
  const w = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [re, idx] of DAY_ALIASES) if (re.test(w)) return idx;
  return null;
}

function toTime(h: string, m?: string): string {
  return `${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`;
}

/**
 * Converte linhas livres do admin ("Segunda a sábado" / "09h às 19h") em
 * OpeningHoursSpecification. Linhas que não forem reconhecidas são ignoradas.
 */
export function buildOpeningHoursSpec(rows: OpeningHoursRow[]) {
  const specs: { '@type': string; dayOfWeek: string[]; opens: string; closes: string }[] = [];
  for (const row of rows) {
    const times = row.hours.match(/(\d{1,2})(?:[h:](\d{2}))?\s*h?\s*(?:às|as|a|-|–)\s*(\d{1,2})(?:[h:](\d{2}))?/i);
    if (!times) continue;
    const label = row.label.toLowerCase();
    const range = label.match(/([a-zçáé]+)[^a-zçáé]+(?:a|à|até|-|–)[^a-zçáé]+([a-zçáé]+)/i);
    let days: number[] = [];
    const first = range ? dayIndex(range[1]) : null;
    const last = range ? dayIndex(range[2]) : null;
    if (range && first !== null && last !== null) {
      for (let d = first; ; d = (d + 1) % 7) {
        days.push(d);
        if (d === last) break;
      }
    } else {
      days = label
        .split(/[^a-zçáé]+/i)
        .map(dayIndex)
        .filter((d): d is number => d !== null);
    }
    if (days.length === 0) continue;
    const opens = toTime(times[1], times[2]);
    const closes = toTime(times[3], times[4]);
    specs.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [...new Set(days)].map((d) => DAYS[d]),
      opens,
      closes,
    });
  }
  return specs;
}

export function buildLocalBusinessJsonLd(ctx: SeoContext) {
  const { baseUrl, settings } = ctx;
  const hours = buildOpeningHoursSpec(settings.openingHours);
  return {
    '@context': 'https://schema.org',
    '@type': 'ClothingStore',
    '@id': `${baseUrl}/#loja`,
    name: settings.storeName,
    url: baseUrl,
    image: absoluteUrl(baseUrl, '/Logo%20Preto.png'),
    description: DEFAULT_DESCRIPTION,
    address: { '@type': 'PostalAddress', ...STORE_ADDRESS },
    sameAs: [INSTAGRAM_URL],
    priceRange: '$$',
    ...(settings.whatsapp ? { telephone: `+${settings.whatsapp}` } : {}),
    ...(hours.length > 0 ? { openingHoursSpecification: hours } : {}),
  };
}

export function buildProductJsonLd(ctx: SeoContext, product: SeoProduct) {
  const { baseUrl } = ctx;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: truncate(product.description, 500),
    image: [absoluteUrl(baseUrl, product.image)],
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/produto/${product.id}`,
      priceCurrency: 'BRL',
      price: finalPrice(product).toFixed(2),
      availability: product.totalStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

interface PageMeta {
  title: string;
  description: string;
  image: string;
  type: 'website' | 'product';
  noindex: boolean;
  jsonLd: unknown[];
}

function resolvePageMeta(ctx: SeoContext): PageMeta {
  const { baseUrl, path, settings, product } = ctx;
  const store = settings.storeName;
  const logo = absoluteUrl(baseUrl, '/Logo%20Preto.png');
  const noindex = NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (product) {
    return {
      title: `${product.name} | ${store}`,
      description: truncate(`${product.name} por R$ ${finalPrice(product).toFixed(2).replace('.', ',')}. ${product.description}`),
      image: absoluteUrl(baseUrl, product.image),
      type: 'product',
      noindex,
      jsonLd: [buildProductJsonLd(ctx, product)],
    };
  }
  const page = PAGE_META[path];
  if (page) {
    return { title: `${page.title} | ${store}`, description: page.description, image: logo, type: 'website', noindex, jsonLd: [] };
  }
  const isHome = path === '/';
  return {
    title: isHome ? `${store} | Moda urbana em Cabo Frio` : store,
    description: DEFAULT_DESCRIPTION,
    image: logo,
    type: 'website',
    noindex,
    jsonLd: isHome ? [buildLocalBusinessJsonLd(ctx)] : [],
  };
}

/** Gera o bloco de tags <head> (título, descrição, canonical, Open Graph, Twitter e JSON-LD). */
export function buildSeoHead(ctx: SeoContext): string {
  const meta = resolvePageMeta(ctx);
  const canonical = `${ctx.baseUrl}${ctx.path === '/' ? '' : ctx.path}`;
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const lines = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}">`,
    ...(meta.noindex ? ['<meta name="robots" content="noindex, nofollow">'] : [`<link rel="canonical" href="${escapeHtml(canonical)}">`]),
    `<meta property="og:site_name" content="${escapeHtml(ctx.settings.storeName)}">`,
    '<meta property="og:locale" content="pt_BR">',
    `<meta property="og:type" content="${meta.type}">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:image" content="${escapeHtml(meta.image)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${escapeHtml(meta.image)}">`,
    ...meta.jsonLd.map((j) => `<script type="application/ld+json">${safeJsonLd(j)}</script>`),
  ];
  return lines.join('\n  ');
}

/** Troca <title>/description originais do index.html pelo bloco de SEO da rota. */
export function injectSeo(html: string, head: string): string {
  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '');
  return cleaned.replace(/<\/head>/i, `  ${head}\n</head>`);
}

export function buildRobotsTxt(baseUrl: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /checkout',
    'Disallow: /minha-conta',
    'Disallow: /favoritos',
    'Disallow: /api/',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

export function buildSitemapXml(baseUrl: string, products: { id: string; updatedAt: Date }[]): string {
  const urls = [
    { loc: `${baseUrl}/`, priority: '1.0' },
    ...Object.keys(PAGE_META).map((p) => ({ loc: `${baseUrl}${p}`, priority: '0.5' })),
    ...products.map((p) => ({
      loc: `${baseUrl}/produto/${p.id}`,
      lastmod: p.updatedAt.toISOString().slice(0, 10),
      priority: '0.8',
    })),
  ] as { loc: string; lastmod?: string; priority: string }[];
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** Origem canônica do site: SITE_URL (produção) ou a do próprio request. */
export function resolveBaseUrl(siteUrl: string | undefined, protocol: string, host: string | undefined): string {
  const configured = siteUrl?.trim().replace(/\/+$/, '');
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  return `${protocol}://${host ?? 'localhost'}`;
}
