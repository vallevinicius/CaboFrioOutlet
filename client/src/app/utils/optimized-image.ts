export type ImageSize = 'thumb' | 'card' | 'full';

export interface OptimizedImage {
  src: string;
  srcset: string | null;
}

// Mesmas regras de server/routes/images.ts: só fotos do site, nome sem subpasta.
const LOCAL_RE = /^\/?(uploads|placeholders)\/([A-Za-z0-9._-]{1,120}\.(?:jpe?g|png|webp))$/i;

/**
 * Versão WebP no tamanho certo (rota /img do servidor).
 * thumb = 480 px (miniaturas), full = 1200 px (foto grande), card = o navegador escolhe entre 480, 800 e 1200.
 * URL externa, data: ou de outra pasta volta como veio.
 */
export function optimizedImage(url: string, size: ImageSize): OptimizedImage {
  const m = LOCAL_RE.exec(url ?? '');
  if (!m) return { src: url, srcset: null };
  const at = (w: number) => `/img/${w}/${m[1]}/${m[2]}`;
  if (size === 'thumb') return { src: at(480), srcset: null };
  if (size === 'full') return { src: at(1200), srcset: null };
  // 800 cobre o cartão em celular de tela 3× (≈ 600 px reais) sem cair na de 1200.
  return { src: at(480), srcset: `${at(480)} 480w, ${at(800)} 800w, ${at(1200)} 1200w` };
}
