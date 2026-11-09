import { Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';

/**
 * Mantém a meta description em sincronia ao navegar dentro do app (SPA).
 * A primeira carga já vem com as tags corretas, injetadas pelo servidor.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private meta = inject(Meta);

  setDescription(text: string): void {
    this.meta.updateTag({ name: 'description', content: truncateDescription(text) });
  }
}

export function truncateDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
