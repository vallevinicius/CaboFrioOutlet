export interface TileLayout {
  layout: string;
  titleSize: string;
}

// Desenho original de "Escolha o seu estilo": grande, pequeno, pequeno, largo (fecha 4 colunas × 2 linhas).
const GROUP: TileLayout[] = [
  { layout: 'col-span-2 row-span-2', titleSize: 'text-5xl sm:text-6xl lg:text-8xl' },
  { layout: 'col-span-1', titleSize: 'text-3xl sm:text-5xl' },
  { layout: 'col-span-1', titleSize: 'text-3xl sm:text-5xl' },
  { layout: 'col-span-2', titleSize: 'text-4xl sm:text-6xl' },
];

// Sobra depois dos grupos de 4: fecha a última linha (2 colunas no celular, 4 no desktop).
const REST: Record<number, TileLayout[]> = {
  1: [{ layout: 'col-span-2 lg:col-span-4', titleSize: 'text-4xl sm:text-6xl' }],
  2: [
    { layout: 'col-span-1 lg:col-span-2', titleSize: 'text-3xl sm:text-5xl' },
    { layout: 'col-span-1 lg:col-span-2', titleSize: 'text-3xl sm:text-5xl' },
  ],
  3: [
    { layout: 'col-span-2 lg:col-span-2', titleSize: 'text-4xl sm:text-6xl' },
    { layout: 'col-span-1', titleSize: 'text-3xl sm:text-5xl' },
    { layout: 'col-span-1', titleSize: 'text-3xl sm:text-5xl' },
  ],
};

/** Tamanho do quadro na posição `index` de `total` categorias. */
export function tileLayout(index: number, total: number): TileLayout {
  const rest = total % 4;
  const firstOfRest = total - rest;
  return index < firstOfRest ? GROUP[index % 4] : REST[rest][index - firstOfRest];
}
