export interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  index: number;
}

/**
 * Calcula as barras de um gráfico de colunas dentro de uma área width×height.
 * Valor zero vira uma barra de 1px (para o dia sem venda continuar visível).
 */
export function barGeometry(values: number[], width: number, height: number, gap = 2): Bar[] {
  if (values.length === 0 || width <= 0 || height <= 0) return [];
  const max = Math.max(...values, 0);
  const slot = width / values.length;
  const barWidth = Math.max(1, slot - gap);
  return values.map((value, index) => {
    const barHeight = max > 0 ? Math.max(value > 0 ? 2 : 1, (value / max) * height) : 1;
    return {
      x: index * slot + (slot - barWidth) / 2,
      y: height - barHeight,
      width: barWidth,
      height: barHeight,
      value,
      index,
    };
  });
}
