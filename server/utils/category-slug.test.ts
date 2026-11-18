import { describe, expect, it } from 'vitest';
import { MAX_SLUG_LENGTH, RESERVED_SLUGS, slugify, validateSlug } from './category-slug.js';

describe('slugify', () => {
  it('tira acento, troca espaço por hífen e deixa minúsculo', () => {
    expect(slugify('Camisas Polo Ção')).toBe('camisas-polo-cao');
    expect(slugify('Bonés')).toBe('bones');
  });
  it('símbolos viram hífen, sem hífens repetidos nem nas pontas', () => {
    expect(slugify('  Moletons & Jaquetas!! ')).toBe('moletons-jaquetas');
    expect(slugify('Tênis---Casual')).toBe('tenis-casual');
  });
  it('nome sem letras nem números gera slug vazio', () => {
    expect(slugify('!!!')).toBe('');
  });
  it(`corta em ${MAX_SLUG_LENGTH} caracteres sem terminar em hífen`, () => {
    expect(MAX_SLUG_LENGTH).toBe(60);
    const slug = slugify(`${'a'.repeat(59)} bb`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('validateSlug', () => {
  it('aceita slug comum', () => {
    expect(validateSlug('jaquetas')).toBeNull();
  });
  it('vazio pede um nome com letras ou números', () => {
    expect(validateSlug('')).toBe('Escolha um nome com letras ou números.');
  });
  it('recusa endereços que já são páginas do site', () => {
    for (const slug of ['produtos', 'produto', 'admin', 'checkout', 'minha-conta', 'favoritos', 'atacado', 'api', 'uploads', 'sobre-nos', 'contato', 'trabalhe-conosco', 'trocas-e-devolucoes', 'perguntas-frequentes', 'guia-de-medidas']) {
      expect(RESERVED_SLUGS).toContain(slug);
      expect(validateSlug(slug)).toBe(`O endereço /${slug} já é usado por outra página do site. Escolha outro nome.`);
    }
  });
});
