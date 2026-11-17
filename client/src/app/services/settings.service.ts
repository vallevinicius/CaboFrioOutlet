import { Injectable, inject, signal } from '@angular/core';
import { DEFAULT_SETTINGS, StoreSettings } from '../types/settings';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private api = inject(ApiService);

  private _settings = signal<StoreSettings>(DEFAULT_SETTINGS);
  readonly settings = this._settings.asReadonly();

  constructor() {
    this.api
      .get<StoreSettings>('/settings')
      .then((settings) => this._settings.set(settings))
      .catch(() => {
        // API indisponível — segue com os valores padrão nesta sessão
      });
  }

  async updateSettings(updates: Partial<StoreSettings>): Promise<void> {
    const updated = await this.api.put<StoreSettings>('/settings', updates);
    this._settings.set(updated);
  }
}

/** Divide o nome da loja em duas partes para reaproveitar o destaque em amarelo do wordmark. */
export function splitStoreName(name: string): { lead: string; accent: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { lead: '', accent: name.trim() };
  const accent = parts.pop() as string;
  return { lead: parts.join(' '), accent };
}

/** Deriva as iniciais usadas no selo circular do logo. */
export function storeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return initials || 'L';
}
