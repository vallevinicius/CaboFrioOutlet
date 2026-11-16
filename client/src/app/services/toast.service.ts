import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  /** Aviso de sucesso (destaque verde). */
  variant?: 'success';
  /** Botão de ação dentro do aviso (ex.: "Ver carrinho"). */
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastOptions {
  variant?: 'success';
  actionLabel?: string;
  onAction?: () => void;
  /** Tempo na tela, em milissegundos (padrão: 3000). */
  durationMs?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  showToast(title: string, description?: string, options?: ToastOptions): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this._toasts.update((prev) => [
      ...prev,
      { id, title, description, variant: options?.variant, actionLabel: options?.actionLabel, onAction: options?.onAction },
    ]);
    setTimeout(() => this.dismissToast(id), options?.durationMs ?? 3000);
  }

  /** Aviso claro de "adicionado ao carrinho": nome, tamanho e atalho para abrir o carrinho. */
  showAddedToCart(productName: string, size: string, openCart: () => void): void {
    this.showToast('Adicionado ao carrinho', `${productName} (Tam. ${size})`, {
      variant: 'success',
      actionLabel: 'Ver carrinho',
      onAction: openCart,
      durationMs: 5000,
    });
  }

  /** Clique no botão de ação do aviso: executa e fecha. */
  runAction(id: string): void {
    const toast = this._toasts().find((t) => t.id === id);
    this.dismissToast(id);
    toast?.onAction?.();
  }

  /** Toast de confirmação: fica na tela até o usuário confirmar ou cancelar (sem fechar sozinho). */
  showConfirm(
    title: string,
    description: string | undefined,
    onConfirm: () => void,
    options?: { confirmLabel?: string; cancelLabel?: string }
  ): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this._toasts.update((prev) => [
      ...prev,
      {
        id,
        title,
        description,
        onConfirm,
        confirmLabel: options?.confirmLabel ?? 'Remover',
        cancelLabel: options?.cancelLabel ?? 'Cancelar',
      },
    ]);
  }

  confirmToast(id: string): void {
    const toast = this._toasts().find((t) => t.id === id);
    this.dismissToast(id);
    toast?.onConfirm?.();
  }

  dismissToast(id: string): void {
    this._toasts.update((prev) => prev.filter((t) => t.id !== id));
  }
}
