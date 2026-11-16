/** Onde a peça é vendida (mesmos valores da API). */
export type SalesChannel = 'retail' | 'wholesale' | 'both';

export const CHANNEL_OPTIONS: { value: SalesChannel; label: string; hint: string }[] = [
  { value: 'retail', label: 'Varejo', hint: 'Só na loja' },
  { value: 'wholesale', label: 'Atacado', hint: 'Só na página de atacado' },
  { value: 'both', label: 'Ambos', hint: 'Na loja e no atacado' },
];

/** Produto sem o campo (API antiga) vale como "ambos". O servidor é quem barra a venda no canal errado. */
export function filterByChannel<T extends { channel?: SalesChannel }>(products: T[], channel: 'retail' | 'wholesale'): T[] {
  return products.filter((p) => p.channel === undefined || p.channel === 'both' || p.channel === channel);
}
