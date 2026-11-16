import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAnyPermission } from '../middleware/permissions.js';
import { UPLOADS_DIR } from '../paths.js';


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Envie apenas arquivos de imagem.'));
      return;
    }
    cb(null, true);
  },
});

export const uploadRouter = Router();

uploadRouter.post(
  '/',
  requireAnyPermission(['produtos', 'edit'], ['banners', 'edit'], ['configuracoes', 'edit']),
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      const filename = `${randomUUID()}.jpg`;

      await sharp(req.file.buffer)
        .resize({ width: 1000, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(path.join(UPLOADS_DIR, filename));

      res.status(201).json({ url: `/uploads/${filename}` });
    } catch {
      res.status(400).json({ error: 'Não foi possível processar a imagem enviada.' });
    }
  },
);
