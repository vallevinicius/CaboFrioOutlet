import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, ShoppingBag, MessageCircle } from 'lucide-angular';
import { CartService } from '../../services/cart.service';
import { SettingsService } from '../../services/settings.service';
import { whatsappUrl } from '../../utils/whatsapp';

/** Cabeçalho exclusivo da área de atacado: deixa claro que é outra parte do site. */
@Component({
  selector: 'app-wholesale-header',
  imports: [RouterLink, LucideAngularModule],
  template: `
    <header class="bg-black text-white">
      <div class="bg-accent text-black">
        <p class="mx-auto max-w-7xl px-4 py-2 text-center font-display text-sm font-semibold uppercase tracking-wide sm:px-6 lg:px-8">
          Área de atacado · para lojistas e revendedores
        </p>
      </div>

      <div class="mx-auto flex h-20 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <a routerLink="/" class="flex flex-shrink-0 items-center gap-3" aria-label="Ir para a página inicial da loja">
          <img src="Logo Preto.png" alt="" class="h-10 w-16 rounded-lg invert" />
          <span class="hidden bg-accent px-2.5 py-1 font-display text-xl font-bold uppercase tracking-tight text-black sm:inline">Atacado</span>
        </a>

        <div class="ml-auto flex items-center gap-2 sm:gap-3">
          @if (whatsapp(); as wa) {
            <a
              [href]="wa"
              target="_blank"
              rel="noopener noreferrer"
              class="hidden items-center gap-2 rounded-sm border border-white/30 px-4 py-2 text-sm font-semibold text-white transition-colors duration-300 hover:border-accent hover:text-accent md:flex"
            >
              <lucide-icon [img]="MessageCircle" class="h-4 w-4" />
              WhatsApp
            </a>
          }
          <a
            routerLink="/"
            class="flex items-center gap-2 rounded-sm border border-white/30 px-4 py-2 text-sm font-semibold text-white transition-colors duration-300 hover:border-accent hover:text-accent"
          >
            <lucide-icon [img]="ArrowLeft" class="h-4 w-4" />
            <span class="hidden sm:inline">Voltar para a loja</span>
            <span class="sm:hidden">Loja</span>
          </a>
          <button
            type="button"
            (click)="cartService.openCart()"
            class="relative flex h-10 w-10 items-center justify-center rounded-sm text-white transition-colors duration-300 hover:bg-white/10"
            aria-label="Abrir carrinho"
          >
            <lucide-icon [img]="ShoppingBag" class="h-5 w-5" />
            @if (cartService.totalItems() > 0) {
              <span class="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-sm bg-accent px-1 font-mono text-[9px] font-bold text-black">
                {{ cartService.totalItems() > 99 ? '99+' : cartService.totalItems() }}
              </span>
            }
          </button>
        </div>
      </div>
    </header>
  `,
})
export class WholesaleHeader {
  cartService = inject(CartService);
  private settingsService = inject(SettingsService);

  readonly ArrowLeft = ArrowLeft;
  readonly ShoppingBag = ShoppingBag;
  readonly MessageCircle = MessageCircle;

  readonly whatsapp = computed(() => whatsappUrl(this.settingsService.settings().whatsapp, 'Olá! Tenho uma loja e gostaria de saber mais sobre o atacado.'));
}
