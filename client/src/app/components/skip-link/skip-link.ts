import { Component } from '@angular/core';

/**
 * Primeiro item focável da página: permite a quem usa teclado ou leitor de
 * tela pular a navegação. (Âncora "#" quebraria com o <base href="/">.)
 */
@Component({
  selector: 'app-skip-link',
  template: `
    <a
      href="/"
      (click)="skip($event)"
      class="fixed left-4 top-4 z-[100] -translate-y-24 rounded-sm bg-accent px-5 py-3 text-sm font-bold text-black shadow-lg transition-transform duration-200 focus:translate-y-0"
    >
      Pular para o conteúdo
    </a>
  `,
})
export class SkipLink {
  skip(event: Event): void {
    event.preventDefault();
    const main = document.querySelector('main') as HTMLElement | null;
    if (!main) return;
    main.setAttribute('tabindex', '-1');
    main.focus({ preventScroll: false });
    main.scrollIntoView({ behavior: 'smooth' });
  }
}
