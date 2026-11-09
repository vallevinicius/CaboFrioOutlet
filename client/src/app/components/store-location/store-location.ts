import { Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { LucideAngularModule, MapPin, Instagram, Navigation, Clock, Mail, MessageCircle } from 'lucide-angular';
import { STORE_INFO, STORE_MAPS_URL } from '../../data/store-info';
import { SettingsService } from '../../services/settings.service';
import { formatWhatsappDisplay, whatsappUrl } from '../../utils/whatsapp';

/** Mapa incorporado (sem chave de API) apontando para o endereço da loja. */
const MAP_EMBED_URL =
  'https://www.google.com/maps?output=embed&q=' +
  encodeURIComponent('Edifício Premier Center, Avenida Júlia Kubitschek, 16, Centro, Cabo Frio - RJ');

@Component({
  selector: 'app-store-location',
  imports: [LucideAngularModule, NgTemplateOutlet],
  templateUrl: './store-location.html',
})
export class StoreLocation {
  private settingsService = inject(SettingsService);
  private sanitizer = inject(DomSanitizer);

  /** `section` = faixa de destaque da home; `card` = bloco compacto dentro de páginas. */
  variant = input<'section' | 'card'>('section');
  /** No card: mostra o mapa embutido. */
  showMap = input(false);
  /** No card: mostra horário, WhatsApp e e-mail. */
  showDetails = input(false);

  readonly MapPin = MapPin;
  readonly Instagram = Instagram;
  readonly Navigation = Navigation;
  readonly Clock = Clock;
  readonly Mail = Mail;
  readonly MessageCircle = MessageCircle;
  readonly info = STORE_INFO;
  readonly mapsUrl = STORE_MAPS_URL;
  // URL constante definida neste arquivo — não vem de entrada do usuário.
  readonly mapEmbed = this.sanitizer.bypassSecurityTrustResourceUrl(MAP_EMBED_URL);

  readonly hours = computed(() => this.settingsService.settings().openingHours);
  readonly email = computed(() => this.settingsService.settings().contactEmail);
  readonly whatsappLink = computed(() => whatsappUrl(this.settingsService.settings().whatsapp));
  readonly whatsappDisplay = computed(() => formatWhatsappDisplay(this.settingsService.settings().whatsapp));
}
