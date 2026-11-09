import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STORY_BODY,
  DEFAULT_TICKER_MESSAGES,
  normalizeStoryBody,
  normalizeStoryTitle,
  normalizeTickerMessages,
  parseTickerMessages,
} from './home-content';

describe('normalizeTickerMessages', () => {
  it('limpa espaços, remove vazios e repetidos (sem diferenciar maiúsculas)', () => {
    expect(normalizeTickerMessages(['  Multimarcas ', '', 'multimarcas', 'Troca   grátis'])).toEqual([
      'Multimarcas',
      'Troca grátis',
    ]);
  });
  it('lista vazia é válida (o admin pode ocultar a faixa)', () => {
    expect(normalizeTickerMessages([])).toEqual([]);
  });
  it('rejeita não-array, itens que não são texto, texto longo e excesso de itens', () => {
    expect(normalizeTickerMessages('x')).toBeNull();
    expect(normalizeTickerMessages([1])).toBeNull();
    expect(normalizeTickerMessages(['a'.repeat(61)])).toBeNull();
    expect(normalizeTickerMessages(Array.from({ length: 9 }, (_, i) => `item ${i}`))).toBeNull();
  });
});

describe('parseTickerMessages', () => {
  it('nulo ou corrompido volta ao padrão', () => {
    expect(parseTickerMessages(null)).toEqual(DEFAULT_TICKER_MESSAGES);
    expect(parseTickerMessages('{quebrado')).toEqual(DEFAULT_TICKER_MESSAGES);
    expect(parseTickerMessages('"texto"')).toEqual(DEFAULT_TICKER_MESSAGES);
  });
  it('respeita lista vazia e lista salva', () => {
    expect(parseTickerMessages('[]')).toEqual([]);
    expect(parseTickerMessages('["Oi"]')).toEqual(['Oi']);
  });
});

describe('normalizeStoryTitle / normalizeStoryBody', () => {
  it('título: normaliza espaços e aceita vazio', () => {
    expect(normalizeStoryTitle('  Dez   anos  ')).toBe('Dez anos');
    expect(normalizeStoryTitle('')).toBe('');
  });
  it('título: rejeita longo demais e tipos errados', () => {
    expect(normalizeStoryTitle('a'.repeat(81))).toBeNull();
    expect(normalizeStoryTitle(5)).toBeNull();
  });
  it('texto: preserva parágrafos, remove excesso de linhas em branco e CRLF', () => {
    expect(normalizeStoryBody('Um.\r\n\r\n\r\n\r\nDois.  \n\n  ')).toBe('Um.\n\nDois.');
  });
  it('texto: aceita vazio, rejeita longo e tipos errados', () => {
    expect(normalizeStoryBody('   ')).toBe('');
    expect(normalizeStoryBody('a'.repeat(1201))).toBeNull();
    expect(normalizeStoryBody(null)).toBeNull();
  });
  it('o texto padrão tem dois parágrafos', () => {
    expect(DEFAULT_STORY_BODY.split('\n\n')).toHaveLength(2);
  });
});
