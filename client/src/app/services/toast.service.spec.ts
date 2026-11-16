import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });
  afterEach(() => vi.useRealTimers());

  it('aviso comum some em 3 segundos', () => {
    service.showToast('Oi');
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(2999);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('a duração pode ser maior e a variante e a ação ficam no aviso', () => {
    const onAction = vi.fn();
    service.showToast('Pronto', 'detalhe', { variant: 'success', actionLabel: 'Ver', onAction, durationMs: 5000 });
    const toast = service.toasts()[0];
    expect(toast).toMatchObject({ title: 'Pronto', description: 'detalhe', variant: 'success', actionLabel: 'Ver' });
    vi.advanceTimersByTime(4999);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('runAction executa a ação e fecha o aviso', () => {
    const onAction = vi.fn();
    service.showToast('Pronto', undefined, { actionLabel: 'Ver', onAction });
    const id = service.toasts()[0].id;
    service.runAction(id);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('showAddedToCart: texto claro com nome e tamanho, botão "Ver carrinho" e 5 segundos', () => {
    const openCart = vi.fn();
    service.showAddedToCart('Camisa Oversized', 'M', openCart);
    const toast = service.toasts()[0];
    expect(toast.title).toBe('Adicionado ao carrinho');
    expect(toast.description).toBe('Camisa Oversized (Tam. M)');
    expect(toast.variant).toBe('success');
    expect(toast.actionLabel).toBe('Ver carrinho');
    service.runAction(toast.id);
    expect(openCart).toHaveBeenCalledTimes(1);
  });

  it('showAddedToCart permanece 5 segundos', () => {
    service.showAddedToCart('Camisa', 'P', () => {});
    vi.advanceTimersByTime(4999);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('o aviso de confirmação (showConfirm) não é afetado: fica até o usuário decidir', () => {
    const onConfirm = vi.fn();
    service.showConfirm('Apagar?', undefined, onConfirm);
    vi.advanceTimersByTime(60_000);
    expect(service.toasts()).toHaveLength(1);
    service.confirmToast(service.toasts()[0].id);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
