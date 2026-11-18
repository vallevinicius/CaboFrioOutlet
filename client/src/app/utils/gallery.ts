/** Índice da foto dando a volta nas pontas (da última vai para a primeira, e vice-versa). */
export function wrapIndex(index: number, total: number): number {
  if (total <= 1) return 0;
  return ((index % total) + total) % total;
}

/** Ponto do zoom em % da foto, preso entre 0 e 100. Sem tamanho ainda, usa o centro. */
export function zoomOrigin(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 50, y: 50 };
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return {
    x: clamp(((clientX - rect.left) / rect.width) * 100),
    y: clamp(((clientY - rect.top) / rect.height) * 100),
  };
}
