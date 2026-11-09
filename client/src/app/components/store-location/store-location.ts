import { Component, input } from '@angular/core';
import { LucideAngularModule, MapPin, Instagram, Navigation } from 'lucide-angular';
import { STORE_INFO, STORE_MAPS_URL } from '../../data/store-info';

@Component({
  selector: 'app-store-location',
  imports: [LucideAngularModule],
  templateUrl: './store-location.html',
})
export class StoreLocation {
  /** `section` = faixa de destaque da home; `card` = bloco compacto dentro de páginas. */
  variant = input<'section' | 'card'>('section');

  readonly MapPin = MapPin;
  readonly Instagram = Instagram;
  readonly Navigation = Navigation;
  readonly info = STORE_INFO;
  readonly mapsUrl = STORE_MAPS_URL;
}
