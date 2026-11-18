import { describe, expect, it } from 'vitest';
import { optimizedImage } from './optimized-image';

describe('optimizedImage', () => {
  it('foto de upload: miniatura, cartão (com srcset) e grande', () => {
    const url = '/uploads/cae59a8b.jpg';
    expect(optimizedImage(url, 'thumb')).toEqual({ src: '/img/480/uploads/cae59a8b.jpg', srcset: null });
    expect(optimizedImage(url, 'full')).toEqual({ src: '/img/1200/uploads/cae59a8b.jpg', srcset: null });
    expect(optimizedImage(url, 'card')).toEqual({
      src: '/img/480/uploads/cae59a8b.jpg',
      srcset: '/img/480/uploads/cae59a8b.jpg 480w, /img/800/uploads/cae59a8b.jpg 800w, /img/1200/uploads/cae59a8b.jpg 1200w',
    });
  });

  it('fotos do site (placeholders), com ou sem barra inicial', () => {
    expect(optimizedImage('/placeholders/cat-camisas.jpg', 'thumb').src).toBe('/img/480/placeholders/cat-camisas.jpg');
    expect(optimizedImage('placeholders/loja.jpg', 'full').src).toBe('/img/1200/placeholders/loja.jpg');
  });

  it('URL externa, data:, vazia ou de outra pasta passa intacta', () => {
    for (const url of ['https://images.unsplash.com/photo-1?w=1600', 'data:image/png;base64,AAAA', '', '/favicon.png', '/uploads/sub/pasta.jpg', '/uploads/x.gif']) {
      expect(optimizedImage(url, 'card')).toEqual({ src: url, srcset: null });
    }
  });
});
