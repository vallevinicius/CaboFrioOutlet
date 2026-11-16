import { describe, expect, it } from 'vitest';
import { canAccess } from './permissions';

describe('canAccess', () => {
  it('editar permite ver e editar', () => {
    expect(canAccess({ pedidos: 'edit' }, 'pedidos', 'view')).toBe(true);
    expect(canAccess({ pedidos: 'edit' }, 'pedidos', 'edit')).toBe(true);
  });
  it('ver permite ver e nega editar', () => {
    expect(canAccess({ pedidos: 'view' }, 'pedidos', 'view')).toBe(true);
    expect(canAccess({ pedidos: 'view' }, 'pedidos', 'edit')).toBe(false);
  });
  it('tela ausente ou permissões indefinidas negam', () => {
    expect(canAccess({ pedidos: 'edit' }, 'produtos', 'view')).toBe(false);
    expect(canAccess(undefined, 'pedidos', 'view')).toBe(false);
    expect(canAccess({}, 'pedidos', 'view')).toBe(false);
  });
});
