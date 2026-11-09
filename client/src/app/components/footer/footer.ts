import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Instagram, ArrowRight, MapPin } from 'lucide-angular';
import { ToastService } from '../../services/toast.service';
import { SettingsService, splitStoreName } from '../../services/settings.service';
import { FOOTER_COLUMNS } from '../../data/footer-links';
import { STORE_INFO } from '../../data/store-info';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-footer',
  imports: [LucideAngularModule, RouterLink],
  templateUrl: './footer.html',
})
export class Footer {
  private toastService = inject(ToastService);
  settingsService = inject(SettingsService);
  analytics = inject(AnalyticsService);

  readonly Instagram = Instagram;
  readonly ArrowRight = ArrowRight;
  readonly MapPin = MapPin;
  readonly linkColumns = FOOTER_COLUMNS;
  readonly splitStoreName = splitStoreName;
  readonly currentYear = new Date().getFullYear();
  readonly instagramUrl = STORE_INFO.instagramUrl;
  readonly store = STORE_INFO;
  readonly hours = computed(() => this.settingsService.settings().openingHours);

  email = signal('');

  handleSubscribe(event: Event): void {
    event.preventDefault();
    if (!this.email()) return;
    this.toastService.showToast('Inscrição confirmada!', 'Você vai receber nossas novidades em breve.');
    this.email.set('');
  }
}
