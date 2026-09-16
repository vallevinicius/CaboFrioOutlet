import { Component, OnInit, inject, signal } from '@angular/core';
import { LucideAngularModule, Plus, X } from 'lucide-angular';
import { SettingsService } from '../../../../services/settings.service';
import { ToastService } from '../../../../services/toast.service';
import { ApiError } from '../../../../services/api-error';
import { formatCep } from '../../../../utils/cep';

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
