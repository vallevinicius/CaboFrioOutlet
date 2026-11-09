import { Component, computed, inject } from '@angular/core';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-ticker',
  template: `
    @if (items().length > 0) {
      <section class="overflow-hidden border-y-2 border-black bg-accent py-3.5" aria-label="Sobre a loja">
        <p class="sr-only">{{ items().join('. ') }}.</p>
        <div class="flex w-max animate-marquee hover:[animation-play-state:paused]" aria-hidden="true">
          @for (copy of copies(); track copy) {
            <div class="flex shrink-0 items-center">
              @for (item of items(); track item) {
                <span class="font-display text-2xl font-semibold uppercase tracking-wide text-black sm:text-3xl">{{ item }}</span>
                <span class="mx-8 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-black bg-white"></span>
              }
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class Ticker {
  private settingsService = inject(SettingsService);

  /** Frases editáveis no admin. Lista vazia oculta a faixa. */
  readonly items = computed(() => this.settingsService.settings().tickerMessages);

  /**
   * A animação desloca -50%: precisa de dois grupos idênticos, e cada grupo
   * precisa ser mais largo que a tela. Com poucas frases, repete o grupo.
   */
  readonly copies = computed(() => {
    const perGroup = Math.max(1, Math.ceil(6 / Math.max(1, this.items().length)));
    return Array.from({ length: perGroup * 2 }, (_, i) => i);
  });
}
