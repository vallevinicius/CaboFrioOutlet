import { RequestHandler, Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAnyPermission } from '../middleware/permissions.js';
import { UPLOADS_DIR } from '../paths.js';

/** Fotos de celular passam fácil de 8 MB; o sharp reduz para 1000px na hora de salvar. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const NOT_AN_IMAGE = 'Envie apenas arquivos de imagem.';
const TOO_LARGE = 'A foto tem mais de 20 MB. Tire a foto em resolução menor ou escolha outra imagem.';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error(NOT_AN_IMAGE));
      return;
    }
    cb(null, true);
  },
});

/** Traduz os erros do multer em respostas claras, em vez de cair no 500 do handler global. */
const receiveImage: RequestHandler = (req, res, next) => {
  upload.single('image')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: TOO_LARGE });
    }
    if (err instanceof Error && err.message === NOT_AN_IMAGE) {
      return res.status(400).json({ error: NOT_AN_IMAGE });
    }
    res.status(400).json({ error: 'Não foi possível receber a imagem enviada.' });
  });
};

export const uploadRouter = Router();

uploadRouter.post(
  '/',
  requireAnyPermission(['produtos', 'edit'], ['banners', 'edit'], ['configuracoes', 'edit']),
  receiveImage,
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      const filename = `${randomUUID()}.jpg`;

      // rotate() sem ângulo aplica a orientação EXIF: foto tirada em pé no celular não fica deitada.
      await sharp(req.file.buffer)
        .rotate()
        // 1600 px: origem nítida para a versão de 1200 (rota /img) e para e-mail/WhatsApp.
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(path.join(UPLOADS_DIR, filename));

      res.status(201).json({ url: `/uploads/${filename}` });
    } catch {
      res.status(400).json({ error: 'Não foi possível processar a imagem enviada.' });
    }
  },
);
