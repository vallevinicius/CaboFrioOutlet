import { describe, expect, it } from 'vitest';
import { MAX_EXTRA_IMAGES, normalizeImages } from './product-images';

describe('normalizeImages', () => {
  it('ausente vira lista vazia', () => {
    expect(normalizeImages(undefined)).toEqual([]);
  });
  it('aceita uploads e URLs http(s), limpa espaços, vazios e repetidos', () => {
    expect(
      normalizeImages(['/uploads/a.jpg', ' /uploads/a.jpg ', '', 'https://x.com/b.png'], '/uploads/capa.jpg'),
    ).toEqual(['/uploads/a.jpg', 'https://x.com/b.png']);
  });
  it('remove a foto que já é a capa', () => {
    expect(normalizeImages(['/uploads/capa.jpg', '/uploads/b.jpg'], '/uploads/capa.jpg')).toEqual(['/uploads/b.jpg']);
  });
  it('rejeita tipos errados, esquemas perigosos e caminhos fora de /uploads', () => {
    expect(normalizeImages('x')).toBeNull();
    expect(normalizeImages([1])).toBeNull();
    expect(normalizeImages(['javascript:alert(1)'])).toBeNull();
    expect(normalizeImages(['data:image/png;base64,AAAA'])).toBeNull();
    expect(normalizeImages(['../../etc/passwd'])).toBeNull();
    expect(normalizeImages(['/uploads/' + 'a'.repeat(200)])).toBeNull();
  });
  it('limita a quantidade de fotos adicionais', () => {
    const ok = Array.from({ length: MAX_EXTRA_IMAGES }, (_, i) => `/uploads/${i}.jpg`);
    expect(normalizeImages(ok)).toHaveLength(MAX_EXTRA_IMAGES);
    expect(normalizeImages([...ok, '/uploads/extra.jpg'])).toBeNull();
  });
});
