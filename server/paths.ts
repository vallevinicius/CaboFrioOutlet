import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Sobe pastas a partir de `startDir` até achar a raiz do projeto (a que tem
 * `package.json` e a pasta `server`). Funciona igual rodando o código-fonte com
 * `tsx` (server/) e o build compilado (server/dist/) — antes, os caminhos eram
 * relativos ao arquivo em execução e quebravam no `dist`.
 */
export function findProjectRoot(startDir: string, exists: (p: string) => boolean = fs.existsSync): string {
  let dir = path.resolve(startDir);
  for (;;) {
    if (exists(path.join(dir, 'package.json')) && exists(path.join(dir, 'server'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Raiz do projeto não encontrada a partir de ${startDir}`);
    dir = parent;
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = findProjectRoot(here);

/** Fotos enviadas pelo admin. Pode ser trocada por UPLOADS_DIR (ex.: disco persistente do servidor). */
export const UPLOADS_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(PROJECT_ROOT, 'server', 'uploads');

/** Build do Angular servido pelo Express. */
export const CLIENT_DIST = path.join(PROJECT_ROOT, 'client', 'dist', 'client', 'browser');
