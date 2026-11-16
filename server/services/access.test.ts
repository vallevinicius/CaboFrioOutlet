import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});

import { SECTIONS, allows, loadAccess, type StaffAccess } from './access.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;

beforeEach(() => mockReset(prisma()));

const row = (over: object = {}) => ({ isAdmin: true, isSuperAdmin: false, role: null, ...over });

describe('loadAccess', () => {
  it('devolve null para usuário inexistente', async () => {
    prisma().user.findUnique.mockResolvedValue(null);
    expect(await loadAccess('x')).toBeNull();
  });

  it('cliente comum não tem permissão nenhuma', async () => {
    prisma().user.findUnique.mockResolvedValue(row({ isAdmin: false }) as never);
    expect(await loadAccess('c1')).toEqual({ isAdmin: false, isSuperAdmin: false, permissions: {} });
  });

  it('converte as permissões do perfil para view/edit', async () => {
    prisma().user.findUnique.mockResolvedValue(
      row({
        role: {
          permissions: [
            { section: 'produtos', level: 'EDIT' },
            { section: 'pedidos', level: 'VIEW' },
          ],
        },
      }) as never,
    );
    expect(await loadAccess('u1')).toEqual({
      isAdmin: true,
      isSuperAdmin: false,
      permissions: { produtos: 'edit', pedidos: 'view' },
    });
  });

  it('ignora seção desconhecida gravada no banco (nunca concede)', async () => {
    prisma().user.findUnique.mockResolvedValue(
      row({ role: { permissions: [{ section: 'equipe', level: 'EDIT' }] } }) as never,
    );
    expect((await loadAccess('u1'))!.permissions).toEqual({});
  });

  it('admin supremo tem editar em todas as telas, mesmo sem perfil', async () => {
    prisma().user.findUnique.mockResolvedValue(row({ isSuperAdmin: true }) as never);
    const access = (await loadAccess('s1'))!;
    expect(access.isSuperAdmin).toBe(true);
    expect(Object.keys(access.permissions).sort()).toEqual([...SECTIONS].sort());
    expect(Object.values(access.permissions).every((l) => l === 'edit')).toBe(true);
  });

  it('quem perdeu o acesso à equipe fica sem permissões mesmo com perfil gravado', async () => {
    prisma().user.findUnique.mockResolvedValue(
      row({ isAdmin: false, role: { permissions: [{ section: 'produtos', level: 'EDIT' }] } }) as never,
    );
    expect((await loadAccess('u1'))!.permissions).toEqual({});
  });
});

describe('allows', () => {
  const staff = (permissions: StaffAccess['permissions'], over: Partial<StaffAccess> = {}): StaffAccess => ({
    isAdmin: true,
    isSuperAdmin: false,
    permissions,
    ...over,
  });

  it('editar permite ver e editar', () => {
    expect(allows(staff({ pedidos: 'edit' }), 'pedidos', 'view')).toBe(true);
    expect(allows(staff({ pedidos: 'edit' }), 'pedidos', 'edit')).toBe(true);
  });
  it('ver permite ver e nega editar', () => {
    expect(allows(staff({ pedidos: 'view' }), 'pedidos', 'view')).toBe(true);
    expect(allows(staff({ pedidos: 'view' }), 'pedidos', 'edit')).toBe(false);
  });
  it('seção ausente nega', () => {
    expect(allows(staff({ pedidos: 'edit' }), 'produtos', 'view')).toBe(false);
  });
  it('quem não é da equipe nega mesmo com permissão no objeto', () => {
    expect(allows(staff({ pedidos: 'edit' }, { isAdmin: false }), 'pedidos', 'view')).toBe(false);
  });
  it('supremo permite tudo', () => {
    expect(allows(staff({}, { isSuperAdmin: true }), 'configuracoes', 'edit')).toBe(true);
  });
});
