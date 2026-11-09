import { Component, inject } from '@angular/core';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-cookie-consent',
  template: `
    @if (analytics.needsConsent()) {
      <div
        class="fixed bottom-4 left-4 right-4 z-[55] rounded-sm border border-slate-200 bg-white p-4 pr-20 shadow-2xl sm:right-auto sm:max-w-md sm:pr-4"
        role="dialog"
        aria-labelledby="cookies-titulo"
      >
        <p id="cookies-titulo" class="text-sm font-bold text-slate-900">Cookies de medição</p>
        <p class="mt-1 text-sm leading-relaxed text-slate-600">
          Usamos cookies para entender como o site é usado e melhorar a sua experiência. Você pode recusar sem perder nenhuma função do site.
        </p>
        <div class="mt-4 flex gap-2">
          <button
            type="button"
            (click)="analytics.accept()"
            class="rounded-sm bg-black px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors duration-300 hover:bg-accent hover:text-black"
          >
            Aceitar
          </button>
          <button
            type="button"
            (click)="analytics.decline()"
            class="rounded-sm border border-slate-300 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-900 transition-colors duration-300 hover:border-slate-900"
          >
            Recusar
          </button>
        </div>
      </div>
    }
  `,
})
export class CookieConsent {
  analytics = inject(AnalyticsService);
}
