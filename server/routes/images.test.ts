import request from 'supertest';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { appWith } from '../test/helpers.js';

const dirs = vi.hoisted(() => ({ root: '' }));
vi.mock('../paths.js', async () => {
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  dirs.root = fs.mkdtempSync(path.join(os.tmpdir(), 'cfo-img-'));
  const uploads = path.join(dirs.root, 'uploads');
  const dist = path.join(dirs.root, 'dist');
  fs.mkdirSync(uploads);
  fs.mkdirSync(path.join(dist, 'placeholders'), { recursive: true });
  // Mesmo padrão de produção: cache dentro de uploads, numa pasta com ponto.
  return { UPLOADS_DIR: uploads, CLIENT_DIST: dist, IMAGE_CACHE_DIR: path.join(uploads, '.variants') };
});

import { IMAGE_WIDTHS, imagesRouter } from './images.js';

const app = appWith('/img', imagesRouter);
const jpeg = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#ffc700' } }).jpeg().toBuffer();

beforeAll(async () => {
  fs.writeFileSync(path.join(dirs.root, 'uploads', 'foto.jpg'), await jpeg(1600, 2000));
  fs.writeFileSync(path.join(dirs.root, 'uploads', 'pequena.jpg'), await jpeg(300, 400));
  fs.writeFileSync(path.join(dirs.root, 'dist', 'placeholders', 'cat-camisas.jpg'), await jpeg(1100, 1400));
});
afterAll(() => fs.rmSync(dirs.root, { recursive: true, force: true }));

const fetchImage = (url: string) =>
  request(app)
    .get(url)
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });

describe('GET /img/:width/:dir/:file', () => {
  it('larguras liberadas: 480, 800 e 1200', () => {
    expect(IMAGE_WIDTHS).toEqual([480, 800, 1200]);
  });

  it('gera WebP na largura pedida, com cache longo para uploads', async () => {
    const res = await fetchImage('/img/480/uploads/foto.jpg').expect(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toBe('public, max-age=2592000, immutable');
    const meta = await sharp(res.body as Buffer).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 480, 600]);
  });

  it('versão grande de 1200 px', async () => {
    const res = await fetchImage('/img/1200/uploads/foto.jpg').expect(200);
    expect((await sharp(res.body as Buffer).metadata()).width).toBe(1200);
  });

  it('não amplia foto menor que a largura pedida', async () => {
    const res = await fetchImage('/img/1200/uploads/pequena.jpg').expect(200);
    expect((await sharp(res.body as Buffer).metadata()).width).toBe(300);
  });

  it('placeholders do site também, com cache de 1 dia', async () => {
    const res = await fetchImage('/img/480/placeholders/cat-camisas.jpg').expect(200);
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
    expect((await sharp(res.body as Buffer).metadata()).width).toBe(480);
  });

  it('guarda a versão em disco e reaproveita no próximo pedido', async () => {
    await fetchImage('/img/480/uploads/foto.jpg').expect(200);
    const cached = path.join(dirs.root, 'uploads', '.variants', '480', 'uploads', 'foto.jpg.webp');
    expect(fs.existsSync(cached)).toBe(true);
    const before = fs.statSync(cached).mtimeMs;
    await fetchImage('/img/480/uploads/foto.jpg').expect(200);
    expect(fs.statSync(cached).mtimeMs).toBe(before);
  });

  it('pedidos simultâneos da mesma versão dão todos certo', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => fetchImage('/img/1200/placeholders/cat-camisas.jpg')));
    for (const r of results) {
      expect(r.status).toBe(200);
      expect((await sharp(r.body as Buffer).metadata()).format).toBe('webp');
    }
  });

  it('largura, pasta ou nome fora da lista → 404 (inclui tentativa de sair da pasta)', async () => {
    for (const url of [
      '/img/999/uploads/foto.jpg',
      '/img/480/server/foto.jpg',
      '/img/480/uploads/nao-existe.jpg',
      '/img/480/uploads/foto.txt',
      '/img/480/uploads/..%2F..%2Fpackage.json',
      '/img/480/uploads/%2E%2E',
      '/img/480/uploads/a%2Fb.jpg',
    ]) {
      await request(app).get(url).expect(404);
    }
  });
});
