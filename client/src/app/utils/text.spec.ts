import { describe, expect, it } from 'vitest';
import { moveItem, splitParagraphs } from './text';

describe('splitParagraphs', () => {
  it('separa por linha em branco e ignora vazios', () => {
    expect(splitParagraphs('Um.\n\nDois.\n\n\n\n  \n\nTrês.')).toEqual(['Um.', 'Dois.', 'Três.']);
  });
  it('quebra de linha simples não separa parágrafo', () => {
    expect(splitParagraphs('Linha 1\nLinha 2')).toEqual(['Linha 1\nLinha 2']);
  });
  it('texto vazio vira lista vazia', () => {
    expect(splitParagraphs('  ')).toEqual([]);
  });
});

describe('moveItem', () => {
  it('sobe e desce itens sem mutar a lista', () => {
    const base = ['a', 'b', 'c'];
    expect(moveItem(base, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(base, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(base).toEqual(['a', 'b', 'c']);
  });
  it('nas pontas ou com índice inválido devolve a mesma lista', () => {
    const base = ['a', 'b'];
    expect(moveItem(base, 0, -1)).toBe(base);
    expect(moveItem(base, 1, 1)).toBe(base);
    expect(moveItem(base, 9, 1)).toBe(base);
  });
});
