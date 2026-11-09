/**
 * Avisa quando a foto do banner não é boa para o hero (que mostra uma foto
 * vertical 4:5). Retorna null se estiver adequada.
 */
export function bannerImageHint(width: number, height: number): string | null {
  if (width <= 0 || height <= 0) return null;
  if (height < 1000) {
    return `A foto é pequena (${width}×${height}px) e pode ficar borrada. Use uma com pelo menos 1400px de altura.`;
  }
  if (width > height * 1.2) {
    return 'A foto é horizontal e será cortada nas laterais. Fotos verticais ou quadradas funcionam melhor.';
  }
  return null;
}
