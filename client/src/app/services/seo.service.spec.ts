import { describe, expect, it } from 'vitest';
import { truncateDescription } from './seo.service';

describe('truncateDescription', () => {
  it('normaliza espaços e quebras de linha', () => {
    expect(truncateDescription('  Camisa   preta\n  oversized ')).toBe('Camisa preta oversized');
  });
  it('mantém textos curtos e corta os longos com reticências', () => {
    expect(truncateDescription('curto')).toBe('curto');
    const out = truncateDescription('a'.repeat(300));
    expect(out.length).toBe(160);
    expect(out.endsWith('…')).toBe(true);
  });
});
