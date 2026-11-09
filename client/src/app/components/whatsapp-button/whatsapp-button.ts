import { Component, computed, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { LucideAngularModule, MessageCircle } from 'lucide-angular';
import { SettingsService } from '../../services/settings.service';
import { whatsappUrl } from '../../utils/whatsapp';

const HIDDEN_ON = ['/admin', '/checkout'];

@Component({
  selector: 'app-whatsapp-button',
  imports: [LucideAngularModule],
  template: `
    @if (url(); as href) {
      <a
        [href]="href"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar com a loja no WhatsApp"
        class="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-300 hover:scale-105 sm:h-auto sm:w-auto sm:gap-2 sm:px-5 sm:py-3.5"
      >
        <lucide-icon [img]="MessageCircle" class="h-6 w-6" />
        <span class="hidden text-sm font-bold sm:inline">Fale conosco</span>
      </a>
    }
  `,
})
export class WhatsappButton {
  private settingsService = inject(SettingsService);
  private router = inject(Router);

  readonly MessageCircle = MessageCircle;

  private path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );

  readonly url = computed(() => {
    const path = this.path();
    if (HIDDEN_ON.some((p) => path === p || path.startsWith(`${p}/`))) return null;
    const { whatsapp, storeName } = this.settingsService.settings();
    return whatsappUrl(whatsapp, `Olá! Vim pelo site da ${storeName} e gostaria de uma ajuda.`);
  });
}
