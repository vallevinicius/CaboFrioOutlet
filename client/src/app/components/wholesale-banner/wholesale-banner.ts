import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { formatPercent, maxDiscount } from '../../utils/wholesale-pricing';

/**
 * Chamada do atacado na home. Fica toda em preto de propósito: é o mesmo visual
 * da área de atacado, então o cliente já percebe que é outra parte do site.
 */
@Component({
  selector: 'app-wholesale-banner',
  imports: [RouterLink],
  template: `
    <section class="bg-black text-white" aria-labelledby="atacado-chamada">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-5 lg:items-center lg:px-8">
        <div class="lg:col-span-3">
          <span class="inline-flex -rotate-2 items-center gap-2.5 rounded-sm bg-accent py-1.5 pl-3 pr-4 font-display text-base font-semibold uppercase text-black">
            <span class="h-2.5 w-2.5 rounded-full border-2 border-black bg-white" aria-hidden="true"></span>
            Para lojistas e revendedores
          </span>
          <h2 id="atacado-chamada" class="mt-5 font-display text-5xl font-bold uppercase leading-[0.92] tracking-tight sm:text-7xl">
            Compre no atacado
            @if (top() > 0) {
              <span class="block text-accent">com até {{ topLabel() }}% off</span>
            }
          </h2>
          <p class="mt-5 max-w-xl text-base leading-relaxed text-zinc-300">
            Pedido mínimo de {{ settings().wholesaleMinPieces }} peças, podendo misturar modelos, marcas e tamanhos. Quanto mais peças, maior o desconto.
          </p>
          <a
            routerLink="/atacado"
            class="mt-8 inline-block rounded-sm bg-accent px-8 py-4 text-sm font-bold uppercase tracking-wide text-black transition-colors duration-300 hover:bg-white"
          >
            Entrar na área de atacado
          </a>
        </div>

        @if (settings().wholesaleTiers.length > 0) {
          <ol class="grid gap-3 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1" aria-label="Descontos por quantidade">
            @for (t of settings().wholesaleTiers; track t.minPieces) {
              <li class="flex items-center justify-between gap-4 rounded-sm border border-zinc-700 bg-zinc-900 px-5 py-4">
                <span class="text-sm text-zinc-300">a partir de <strong class="text-white">{{ t.minPieces }}</strong> peças</span>
                <span class="font-display text-4xl font-bold leading-none text-accent">{{ pct(t.discountPercent) }}%</span>
              </li>
            }
          </ol>
        }
      </div>
    </section>
  `,
})
export class WholesaleBanner {
  readonly settings = inject(SettingsService).settings;
  readonly top = computed(() => maxDiscount(this.settings().wholesaleTiers));
  readonly topLabel = computed(() => formatPercent(this.top()));
  readonly pct = formatPercent;
}
