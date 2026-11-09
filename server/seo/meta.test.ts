import { describe, expect, it } from 'vitest';
import {
  SeoContext,
  SeoProduct,
  buildOpeningHoursSpec,
  buildRobotsTxt,
  buildSeoHead,
  buildSitemapXml,
  escapeHtml,
  finalPrice,
  injectSeo,
  resolveBaseUrl,
  safeJsonLd,
  truncate,
} from './meta';

const BASE = 'https://loja.com.br';
const settings = {
  storeName: 'Cabo Frio Outlet',
  whatsapp: '5522999991234',
  openingHours: [
    { label: 'Segunda a sábado', hours: '09h às 19h' },
    { label: 'Domingo', hours: '09h às 14h' },
  ],
};
const product: SeoProduct = {
  id: 'abc123',
  name: 'Camisa Oversized',
  description: 'Algodão pesado.',
  image: '/uploads/camisa.jpg',
  price: 100,
  discountPercent: 10,
  brand: 'High',
  totalStock: 3,
};
const ctx = (over: Partial<SeoContext> = {}): SeoContext => ({ baseUrl: BASE, path: '/', settings, ...over });

describe('buildOpeningHoursSpec', () => {
  it('converte seg–sáb e domingo do padrão da loja', () => {
    expect(buildOpeningHoursSpec(settings.openingHours)).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '09:00',
        closes: '19:00',
      },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Sunday'], opens: '09:00', closes: '14:00' },
    ]);
  });
  it('entende minutos e intervalo que atravessa o domingo', () => {
    const [spec] = buildOpeningHoursSpec([{ label: 'Sexta a segunda', hours: '10:30 às 20h' }]);
    expect(spec.dayOfWeek).toEqual(['Friday', 'Saturday', 'Sunday', 'Monday']);
    expect(spec.opens).toBe('10:30');
    expect(spec.closes).toBe('20:00');
  });
  it('ignora linhas que não consegue interpretar', () => {
    expect(buildOpeningHoursSpec([{ label: 'Feriados', hours: 'Fechado' }])).toEqual([]);
    expect(buildOpeningHoursSpec([{ label: 'Quando der', hours: '09h às 19h' }])).toEqual([]);
  });
});

describe('buildSeoHead', () => {
  it('home: título, canonical, Open Graph e LocalBusiness com telefone e horários', () => {
    const head = buildSeoHead(ctx());
    expect(head).toContain('<title>Cabo Frio Outlet | Moda urbana em Cabo Frio</title>');
    expect(head).toContain(`<link rel="canonical" href="${BASE}">`);
    expect(head).toContain('property="og:image" content="https://loja.com.br/Logo%20Preto.png"');
    expect(head).toContain('"@type":"ClothingStore"');
    expect(head).toContain('"telephone":"+5522999991234"');
    expect(head).toContain('"openingHoursSpecification"');
  });
  it('LocalBusiness omite telefone quando não configurado', () => {
    const head = buildSeoHead(ctx({ settings: { ...settings, whatsapp: '' } }));
    expect(head).not.toContain('telephone');
  });
  it('página institucional usa título e descrição próprios', () => {
    const head = buildSeoHead(ctx({ path: '/trocas-e-devolucoes' }));
    expect(head).toContain('<title>Trocas e devoluções | Cabo Frio Outlet</title>');
    expect(head).toContain(`href="${BASE}/trocas-e-devolucoes"`);
    expect(head).not.toContain('ClothingStore');
  });
  it('produto: og:type product, preço com desconto e disponibilidade', () => {
    const head = buildSeoHead(ctx({ path: '/produto/abc123', product }));
    expect(head).toContain('property="og:type" content="product"');
    expect(head).toContain('og:image" content="https://loja.com.br/uploads/camisa.jpg"');
    expect(head).toContain('"price":"90.00"');
    expect(head).toContain('"availability":"https://schema.org/InStock"');
    expect(head).toContain('"brand":{"@type":"Brand","name":"High"}');
  });
  it('produto sem estoque fica OutOfStock', () => {
    const head = buildSeoHead(ctx({ path: '/produto/abc123', product: { ...product, totalStock: 0 } }));
    expect(head).toContain('OutOfStock');
  });
  it('áreas privadas recebem noindex e não têm canonical', () => {
    for (const path of ['/admin', '/checkout', '/minha-conta', '/admin/x']) {
      const head = buildSeoHead(ctx({ path }));
      expect(head, path).toContain('noindex');
      expect(head, path).not.toContain('canonical');
    }
  });
  it('escapa HTML do nome do produto e impede fechar o <script> do JSON-LD (XSS)', () => {
    const evil = { ...product, name: '"><script>alert(1)</script>', description: '</script><img src=x onerror=alert(1)>' };
    const head = buildSeoHead(ctx({ path: '/produto/abc123', product: evil }));
    expect(head).not.toContain('<script>alert');
    expect(head).not.toContain('</script><img');
    expect(head).toContain('&lt;script&gt;');
    // só os nossos <script type="application/ld+json"> podem existir
    expect(head.match(/<script/g)?.length).toBe(1);
  });
});

describe('helpers', () => {
  it('escapeHtml e safeJsonLd', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(safeJsonLd({ a: '</script>' })).not.toContain('<');
  });
  it('finalPrice arredonda e aplica desconto', () => {
    expect(finalPrice({ price: 99.9, discountPercent: null })).toBe(99.9);
    expect(finalPrice({ price: 100, discountPercent: 15 })).toBe(85);
    expect(finalPrice({ price: 33.33, discountPercent: 33 })).toBe(22.33);
  });
  it('truncate respeita o limite', () => {
    expect(truncate('a'.repeat(400)).length).toBe(160);
    expect(truncate('  oi   mundo ')).toBe('oi mundo');
  });
  it('resolveBaseUrl prefere SITE_URL válida e ignora valores suspeitos', () => {
    expect(resolveBaseUrl('https://loja.com.br/', 'http', 'localhost:3003')).toBe('https://loja.com.br');
    expect(resolveBaseUrl('javascript:alert(1)', 'http', 'localhost:3003')).toBe('http://localhost:3003');
    expect(resolveBaseUrl(undefined, 'https', 'x.com')).toBe('https://x.com');
  });
});

describe('injectSeo', () => {
  const html = '<html><head><title>Velho</title>\n<meta name="description" content="velha">\n<meta charset="utf-8"></head><body></body></html>';
  it('remove title e description antigos e insere o novo bloco antes de </head>', () => {
    const out = injectSeo(html, '<title>Novo</title>');
    expect(out).not.toContain('Velho');
    expect(out).not.toContain('velha');
    expect(out).toContain('<title>Novo</title>\n</head>');
    expect(out).toContain('<meta charset="utf-8">');
  });
});

describe('robots e sitemap', () => {
  it('robots bloqueia áreas privadas e aponta o sitemap', () => {
    const txt = buildRobotsTxt(BASE);
    expect(txt).toContain('Disallow: /admin');
    expect(txt).toContain('Disallow: /checkout');
    expect(txt).toContain(`Sitemap: ${BASE}/sitemap.xml`);
  });
  it('sitemap lista home, páginas institucionais e produtos, sem rotas privadas', () => {
    const xml = buildSitemapXml(BASE, [{ id: 'p1', updatedAt: new Date('2026-11-01T10:00:00Z') }]);
    expect(xml).toContain(`<loc>${BASE}/</loc>`);
    expect(xml).toContain(`<loc>${BASE}/sobre-nos</loc>`);
    expect(xml).toContain(`<loc>${BASE}/produto/p1</loc><lastmod>2026-11-01</lastmod>`);
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/checkout');
  });
});
