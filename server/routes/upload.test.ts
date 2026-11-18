import request from 'supertest';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { FULL_EDIT, appWith, mockAccess, tokenFor } from '../test/helpers.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});

const tmp = vi.hoisted(() => ({ dir: '' }));
vi.mock('../paths.js', async () => {
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  tmp.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfo-upload-'));
  return { UPLOADS_DIR: tmp.dir };
});

import { MAX_UPLOAD_BYTES, uploadRouter } from './upload.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/upload', uploadRouter);
const auth = tokenFor('admin-1', true);

const jpeg = (width: number, height: number, orientation?: number) => {
  const img = sharp({ create: { width, height, channels: 3, background: '#ffc700' } }).jpeg();
  return (orientation ? img.withMetadata({ orientation }) : img).toBuffer();
};
const savedFile = (url: string) => path.join(tmp.dir, path.basename(url));

beforeEach(() => {
  mockReset(prisma());
  mockAccess(prisma(), 'admin-1', { permissions: FULL_EDIT });
});
afterAll(() => fs.rmSync(tmp.dir, { recursive: true, force: true }));

describe('POST /api/upload', () => {
  it('aceita imagem e salva JPG', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', auth)
      .attach('image', await jpeg(40, 30), 'foto.jpg')
      .expect(201);
    expect(res.body.url).toMatch(/^\/uploads\/.+\.jpg$/);
    expect(fs.existsSync(savedFile(res.body.url))).toBe(true);
  });

  it('respeita a orientação EXIF (foto tirada em pé no celular)', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', auth)
      .attach('image', await jpeg(20, 10, 6), 'em-pe.jpg')
      .expect(201);
    const meta = await sharp(savedFile(res.body.url)).metadata();
    expect([meta.width, meta.height]).toEqual([10, 20]);
  });

  it('o limite é de 20 MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(20 * 1024 * 1024);
  });

  it('recusa acima de 20 MB com 413 e mensagem em português', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', auth)
      .attach('image', Buffer.alloc(MAX_UPLOAD_BYTES + 1), { filename: 'enorme.jpg', contentType: 'image/jpeg' })
      .expect(413);
    expect(res.body.error).toBe('A foto tem mais de 20 MB. Tire a foto em resolução menor ou escolha outra imagem.');
  });

  it('recusa arquivo que não é imagem com 400', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', auth)
      .attach('image', Buffer.from('oi'), { filename: 'nota.txt', contentType: 'text/plain' })
      .expect(400);
    expect(res.body.error).toBe('Envie apenas arquivos de imagem.');
  });

  it('exige permissão', async () => {
    await request(app).post('/api/upload').attach('image', await jpeg(4, 4), 'x.jpg').expect(401);
  });
});
