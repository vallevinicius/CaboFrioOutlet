import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { FAVORITES_KEY, parseStoredFavorites, toggleId } from '../utils/favorites';

/**
 * Favoritos: visitantes guardam no navegador; quem está logado salva na conta.
 * Ao entrar, os favoritos do navegador são somados aos da conta.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  private _ids = signal<string[]>(this.readLocal());
  readonly ids = this._ids.asReadonly();
  readonly count = computed(() => this._ids().length);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      untracked(() => (user ? void this.syncWithAccount() : this._ids.set(this.readLocal())));
    });
  }

  isFavorite(productId: string): boolean {
    return this._ids().includes(productId);
  }

  async toggle(productId: string): Promise<void> {
    const previous = this._ids();
    const { ids, added } = toggleId(previous, productId);
    this._ids.set(ids); // atualiza na hora; desfaz se o servidor recusar

    if (!this.auth.isAuthenticated()) {
      this.writeLocal(ids);
      return;
    }
    try {
      if (added) await this.api.put(`/favorites/${productId}`);
      else await this.api.delete(`/favorites/${productId}`);
    } catch {
      this._ids.set(previous);
      this.toast.showToast('Não foi possível atualizar seus favoritos', 'Tente novamente em instantes.');
    }
  }

  private async syncWithAccount(): Promise<void> {
    try {
      const local = this.readLocal();
      const { productIds } = await this.api.post<{ productIds: string[] }>('/favorites/merge', { productIds: local });
      this._ids.set(productIds);
      this.writeLocal([]);
    } catch {
      // Sem rede/servidor: mantém o que já está na tela.
    }
  }

  private readLocal(): string[] {
    try {
      return parseStoredFavorites(localStorage.getItem(FAVORITES_KEY));
    } catch {
      return [];
    }
  }

  private writeLocal(ids: string[]): void {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
    } catch {
      // Armazenamento bloqueado (modo privado): favoritos valem só nesta sessão.
    }
  }
}
