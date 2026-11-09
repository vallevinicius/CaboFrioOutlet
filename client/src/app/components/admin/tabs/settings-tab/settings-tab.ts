import { Component, OnInit, inject, signal } from '@angular/core';
import { LucideAngularModule, Plus, X, ArrowUp, ArrowDown } from 'lucide-angular';
import { SettingsService } from '../../../../services/settings.service';
import { ToastService } from '../../../../services/toast.service';
import { ApiError } from '../../../../services/api-error';
import { formatCep } from '../../../../utils/cep';
import { formatPhone } from '../../../../utils/phone';
import { moveItem } from '../../../../utils/text';
import { OpeningHoursRow } from '../../../../types/settings';

@Component({
  selector: 'app-settings-tab',
  imports: [LucideAngularModule],
  templateUrl: './settings-tab.html',
})
export class SettingsTab implements OnInit {
  private settingsService = inject(SettingsService);
  private toastService = inject(ToastService);

  readonly Plus = Plus;
  readonly X = X;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;

  storeName = signal('');
  threshold = signal('');
  shippingFee = signal('');
  originCep = signal('');
  melhorEnvioToken = signal('');
  melhorEnvioSandbox = signal(true);
  hasMelhorEnvioToken = signal(false);
  messages = signal<string[]>([]);
  messageInput = signal('');
  brands = signal<string[]>([]);
  brandInput = signal('');
  whatsapp = signal('');
  contactEmail = signal('');
  openingHours = signal<OpeningHoursRow[]>([]);
  googlePlaceId = signal('');
  tickerMessages = signal<string[]>([]);
  tickerInput = signal('');
  storyTitle = signal('');
  storyBody = signal('');
  saving = signal(false);

  ngOnInit(): void {
    const settings = this.settingsService.settings();
    this.storeName.set(settings.storeName);
    this.threshold.set(String(settings.freeShippingThreshold));
    this.shippingFee.set(String(settings.shippingFee));
    this.originCep.set(formatCep(settings.originCep));
    this.melhorEnvioSandbox.set(settings.melhorEnvioSandbox);
    this.hasMelhorEnvioToken.set(settings.hasMelhorEnvioToken);
    this.messages.set(settings.announcementMessages);
    this.brands.set(settings.brands);
    // O número é salvo com DDI 55; no campo mostramos só DDD + número.
    this.whatsapp.set(formatPhone(settings.whatsapp.replace(/^55/, '')));
    this.contactEmail.set(settings.contactEmail);
    this.openingHours.set(settings.openingHours.map((row) => ({ ...row })));
    this.googlePlaceId.set(settings.googlePlaceId);
    this.tickerMessages.set([...settings.tickerMessages]);
    this.storyTitle.set(settings.storyTitle);
    this.storyBody.set(settings.storyBody);
  }

  addTickerMessage(): void {
    const value = this.tickerInput().trim();
    if (value && !this.tickerMessages().includes(value)) {
      this.tickerMessages.update((prev) => [...prev, value]);
    }
    this.tickerInput.set('');
  }

  removeTickerMessage(index: number): void {
    this.tickerMessages.update((prev) => prev.filter((_, i) => i !== index));
  }

  moveTickerMessage(index: number, direction: -1 | 1): void {
    this.tickerMessages.update((prev) => moveItem(prev, index, direction));
  }

  onTickerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addTickerMessage();
    }
  }

  onWhatsappInput(value: string): void {
    this.whatsapp.set(formatPhone(value));
  }

  addHoursRow(): void {
    this.openingHours.update((prev) => [...prev, { label: '', hours: '' }]);
  }

  removeHoursRow(index: number): void {
    this.openingHours.update((prev) => prev.filter((_, i) => i !== index));
  }

  updateHoursRow(index: number, field: keyof OpeningHoursRow, value: string): void {
    this.openingHours.update((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  onOriginCepInput(value: string): void {
    this.originCep.set(formatCep(value));
  }

  addMessage(): void {
    const value = this.messageInput().trim();
    if (!value) return;
    this.messages.update((prev) => [...prev, value]);
    this.messageInput.set('');
  }

  removeMessage(index: number): void {
    this.messages.update((prev) => prev.filter((_, i) => i !== index));
  }

  onMessageInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addMessage();
    }
  }

  addBrand(): void {
    const value = this.brandInput().trim();
    if (!value || this.brands().includes(value)) {
      this.brandInput.set('');
      return;
    }
    this.brands.update((prev) => [...prev, value]);
    this.brandInput.set('');
  }

  removeBrand(index: number): void {
    this.brands.update((prev) => prev.filter((_, i) => i !== index));
  }

  onBrandInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addBrand();
    }
  }

  async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const current = this.settingsService.settings();
    const thresholdNum = parseFloat(this.threshold().replace(',', '.'));
    const shippingFeeNum = parseFloat(this.shippingFee().replace(',', '.'));

    this.saving.set(true);
    try {
      await this.settingsService.updateSettings({
        storeName: this.storeName().trim() || current.storeName,
        freeShippingThreshold: thresholdNum > 0 ? thresholdNum : current.freeShippingThreshold,
        shippingFee: shippingFeeNum >= 0 ? shippingFeeNum : current.shippingFee,
        originCep: this.originCep().replace(/\D/g, ''),
        melhorEnvioToken: this.melhorEnvioToken().trim() || undefined,
        melhorEnvioSandbox: this.melhorEnvioSandbox(),
        announcementMessages: this.messages(),
        brands: this.brands(),
        whatsapp: this.whatsapp().replace(/\D/g, ''),
        contactEmail: this.contactEmail().trim(),
        openingHours: this.openingHours(),
        googlePlaceId: this.googlePlaceId().trim(),
        tickerMessages: this.tickerMessages(),
        storyTitle: this.storyTitle().trim(),
        storyBody: this.storyBody().trim(),
      });
      this.melhorEnvioToken.set('');
      this.toastService.showToast('Configurações salvas!', 'As alterações já estão valendo na loja.');
    } catch (err) {
      this.toastService.showToast(
        'Erro ao salvar configurações',
        err instanceof ApiError ? err.message : undefined
      );
    } finally {
      this.saving.set(false);
    }
  }
}
