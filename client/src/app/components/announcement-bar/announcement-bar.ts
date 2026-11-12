import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { formatPercent, maxDiscount } from '../../utils/wholesale-pricing';

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Component({
  selector: 'app-announcement-bar',
  imports: [RouterLink],
  templateUrl: './announcement-bar.html',
})
export class AnnouncementBar {
  private settingsService = inject(SettingsService);

  readonly loop = computed(() => {
    const settings = this.settingsService.settings();
    const top = maxDiscount(settings.wholesaleTiers);
    const messages: { text: string; link?: string }[] = [
      { text: `Frete grátis acima de ${formatPrice(settings.freeShippingThreshold)}` },
      // Atacado sempre em destaque, com o maior desconto das faixas definidas no admin.
      {
        text: top > 0 ? `Atacado com até ${formatPercent(top)}% de desconto` : 'Atacado para lojistas e revendedores',
        link: '/atacado',
      },
      ...settings.announcementMessages.map((text) => ({ text })),
    ];
    return [...messages, ...messages];
  });
}
