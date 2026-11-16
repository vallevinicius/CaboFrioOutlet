import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SERVER_DIR = path.dirname(new URL(import.meta.url).pathname);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return ['dist', 'node_modules', 'uploads'].includes(entry.name) ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

const RELATIVE = /(?:\bfrom\s+|\bimport\s*\(\s*|^import\s+)(['"])(\.{1,2}\/[^'"]*)\1/gm;

/**
 * O servidor roda em produção como ES Modules do Node (node server/dist/index.js),
 * que EXIGE a extensão ".js" nos imports relativos. Sem ela, o servidor não sobe:
 * "Cannot find module .../server/dist/routes/auth".
 */
describe('imports relativos do backend (ES Modules do Node)', () => {
  const files = sourceFiles(SERVER_DIR).filter((f) => !f.endsWith('.test.ts'));

  it('encontra os arquivos do servidor (guarda contra teste vazio)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith(path.join('routes', 'auth.ts')))).toBe(true);
  });

  it('todo import relativo termina em .js e aponta para um arquivo .ts existente', () => {
    const problems: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(RELATIVE)) {
        const spec = match[2];
        const rel = path.relative(SERVER_DIR, file);
        if (!spec.endsWith('.js') && !spec.endsWith('.json')) {
          problems.push(`${rel}: "${spec}" sem extensão .js`);
        } else if (spec.endsWith('.js') && !fs.existsSync(path.resolve(path.dirname(file), spec.replace(/\.js$/, '.ts')))) {
          problems.push(`${rel}: "${spec}" não aponta para um arquivo existente`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('o tsconfig de produção usa as regras do Node (NodeNext), que recusam import sem extensão', () => {
    const raw = fs.readFileSync(path.join(SERVER_DIR, 'tsconfig.json'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    const config = JSON.parse(raw);
    expect(config.compilerOptions.module).toBe('NodeNext');
    expect(config.compilerOptions.moduleResolution).toBe('NodeNext');
    expect(config.exclude).toContain('**/*.test.ts');
  });
});
