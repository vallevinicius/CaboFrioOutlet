import { Router } from 'express';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { CLIENT_DIST, IMAGE_CACHE_DIR, UPLOADS_DIR } from '../paths.js';

/** Larguras servidas: 480 (miniaturas e cartões), 800 (cartões em tela de alta densidade), 1200 (foto grande). */
export const IMAGE_WIDTHS = [480, 800, 1200] as const;
const WEBP_QUALITY = 78;
const FILE_RE = /^[A-Za-z0-9._-]{1,120}\.(jpe?g|png|webp)$/i;

const SOURCES: Record<string, { root: () => string; cacheControl: string }> = {
  // Nomes de upload são UUIDs: o conteúdo nunca muda.
  uploads: { root: () => UPLOADS_DIR, cacheControl: 'public, max-age=2592000, immutable' },
  // Fotos que vêm com o site; podem mudar num deploy.
  placeholders: { root: () => path.join(CLIENT_DIST, 'placeholders'), cacheControl: 'public, max-age=86400' },
};

/** Uma geração por arquivo de cada vez: pedidos simultâneos esperam a mesma promessa. */
const inFlight = new Map<string, Promise<void>>();

async function mtime(file: string): Promise<number | null> {
  try {
    return (await fs.stat(file)).mtimeMs;
  } catch {
    return null;
  }
}

async function generate(source: string, target: string, width: number): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${randomUUID()}.tmp`;
  await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toFile(tmp);
  await fs.rename(tmp, target); // troca atômica: ninguém lê um arquivo pela metade
}

export const imagesRouter = Router();

imagesRouter.get('/:width/:dir/:file', async (req, res, next) => {
  const width = Number(req.params.width);
  const { dir, file } = req.params;
  const source = SOURCES[dir];
  // FILE_RE não aceita barra: o nome nunca sai da pasta de origem (sem path traversal).
  if (!(IMAGE_WIDTHS as readonly number[]).includes(width) || !source || !FILE_RE.test(file)) {
    return res.status(404).end();
  }

  const sourcePath = path.join(source.root(), file);
  const target = path.join(IMAGE_CACHE_DIR, String(width), dir, `${file}.webp`);
  try {
    const sourceTime = await mtime(sourcePath);
    if (sourceTime === null) return res.status(404).end();

    const cachedTime = await mtime(target);
    if (cachedTime === null || cachedTime < sourceTime) {
      let job = inFlight.get(target);
      if (!job) {
        job = generate(sourcePath, target, width).finally(() => inFlight.delete(target));
        inFlight.set(target, job);
      }
      await job;
    }

    res.setHeader('Cache-Control', source.cacheControl);
    res.type('image/webp');
    res.sendFile(target, (err) => {
      if (err && !res.headersSent) next(err);
    });
  } catch {
    // Arquivo que o sharp não consegue ler: trata como ausente.
    if (!res.headersSent) res.status(404).end();
  }
});
