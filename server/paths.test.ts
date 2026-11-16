import path from 'path';
import { describe, expect, it } from 'vitest';
import { CLIENT_DIST, PROJECT_ROOT, UPLOADS_DIR, findProjectRoot } from './paths.js';

/** Monta um "sistema de arquivos" falso só com estes caminhos. */
const fakeFs = (paths: string[]) => (p: string) => paths.includes(path.resolve(p));

describe('findProjectRoot', () => {
  const exists = fakeFs(['/app/package.json', '/app/server', '/app/server/dist']);

  it('acha a mesma raiz rodando do código-fonte (server/) e do build (server/dist/...)', () => {
    expect(findProjectRoot('/app/server', exists)).toBe('/app');
    expect(findProjectRoot('/app/server/dist', exists)).toBe('/app');
    expect(findProjectRoot('/app/server/dist/routes', exists)).toBe('/app');
  });

  it('não confunde com uma pasta que só tem package.json (sem a pasta server)', () => {
    const e = fakeFs(['/app/package.json', '/app/server', '/app/client/package.json']);
    expect(findProjectRoot('/app/client', e)).toBe('/app');
  });

  it('erra com mensagem clara se não achar a raiz', () => {
    expect(() => findProjectRoot('/x/y', fakeFs([]))).toThrow('Raiz do projeto não encontrada');
  });
});

describe('caminhos reais do projeto', () => {
  it('a raiz tem o package.json, e fotos e build do front ficam dentro dela', () => {
    expect(path.basename(UPLOADS_DIR)).toBe('uploads');
    expect(UPLOADS_DIR.startsWith(PROJECT_ROOT)).toBe(true);
    expect(CLIENT_DIST).toBe(path.join(PROJECT_ROOT, 'client', 'dist', 'client', 'browser'));
    // nunca dentro de server/dist (o bug do build compilado)
    expect(UPLOADS_DIR).not.toContain(`${path.sep}dist${path.sep}`);
    expect(CLIENT_DIST).not.toContain(`${path.sep}server${path.sep}`);
  });
});
