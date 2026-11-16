import { describe, expect, it } from 'vitest';
import { filterByChannel, type SalesChannel } from './channel';

type P = { id: string; channel?: SalesChannel };

const retail = { id: 'r', channel: 'retail' as const };
const wholesale = { id: 'w', channel: 'wholesale' as const };
const both = { id: 'b', channel: 'both' as const };
const legacy = { id: 'l' }; // API antiga, sem o campo: vale como "ambos"
const all: P[] = [retail, wholesale, both, legacy];

describe('filterByChannel', () => {
  it('a loja (varejo) mostra varejo e ambos, nunca só-atacado', () => {
    expect(filterByChannel(all, 'retail').map((p) => p.id)).toEqual(['r', 'b', 'l']);
  });
  it('a página de atacado mostra atacado e ambos, nunca só-varejo', () => {
    expect(filterByChannel(all, 'wholesale').map((p) => p.id)).toEqual(['w', 'b', 'l']);
  });
  it('não altera a lista original e aceita lista vazia', () => {
    const copy = [...all];
    filterByChannel(all, 'retail');
    expect(all).toEqual(copy);
    expect(filterByChannel([], 'retail')).toEqual([]);
  });
});
