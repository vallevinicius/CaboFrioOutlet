import { describe, expect, it } from 'vitest';
import { FOOTER_COLUMNS } from './footer-links';
import { INSTITUTIONAL_PAGES, findInstitutionalPage } from './institutional-pages';
import { STORE_INFO, STORE_MAPS_URL } from './store-info';

describe('páginas institucionais', () => {
  it('toda rota institucional do rodapé tem conteúdo correspondente', () => {
    // /atacado tem página própria (formulário), fora do conteúdo institucional estático.
    const PAGES_WITH_OWN_COMPONENT = ['/atacado'];
    const internal = FOOTER_COLUMNS.flatMap((c) => c.links)
      .filter((l) => !['/camisas', '/calcas', '/bermudas', '/bones', '/produtos'].includes(l.path))
      .filter((l) => !PAGES_WITH_OWN_COMPONENT.includes(l.path));
    expect(internal.length).toBe(6);
    for (const link of internal) {
      expect(findInstitutionalPage(link.path.slice(1)), link.path).toBeDefined();
    }
  });

  it('slugs são únicos e todas as páginas têm título e conteúdo', () => {
    const slugs = INSTITUTIONAL_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const page of INSTITUTIONAL_PAGES) {
      expect(page.title).not.toBe('');
      expect(page.blocks.length).toBeGreaterThan(0);
    }
  });

  it('retorna undefined para slug inexistente ou ausente', () => {
    expect(findInstitutionalPage('nao-existe')).toBeUndefined();
    expect(findInstitutionalPage(undefined)).toBeUndefined();
  });

  it('"Sobre nós" cita os 10 anos de loja e mostra a localização', () => {
    const about = findInstitutionalPage('sobre-nos')!;
    expect(JSON.stringify(about)).toContain('10 anos');
    expect(about.blocks.some((b) => b.type === 'location')).toBe(true);
  });

  it('o rodapé aponta para a página de atacado', () => {
    const links = FOOTER_COLUMNS.flatMap((c) => c.links);
    expect(links.some((l) => l.path === '/atacado')).toBe(true);
  });

  it('categorias do rodapé apontam para as páginas de cada categoria e para todos os produtos', () => {
    const cats = FOOTER_COLUMNS.find((c) => c.title === 'Categorias')!.links;
    expect(cats.map((l) => l.path)).toEqual(['/camisas', '/calcas', '/bermudas', '/bones', '/produtos']);
    expect(cats.map((l) => l.label)).toEqual(['Camisas', 'Calças', 'Bermudas', 'Bonés', 'Todos os produtos']);
  });

  it('link do mapa codifica o endereço da loja', () => {
    expect(STORE_MAPS_URL).toContain('Premier%20Center');
    expect(STORE_INFO.addressLines.join(' ')).toContain('Júlia Kubitschek');
  });
});
