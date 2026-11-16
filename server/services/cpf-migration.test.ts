import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import { encryptExistingCpfs } from './cpf-migration.js';
import { openCpf, sealCpf } from '../utils/cpf-vault.js';

// O serviço recebe o banco por parâmetro: dá para testar com um mock só dele.
const db = mockDeep<PrismaClient>();
const prisma = () => db;
beforeEach(() => mockReset(db));

describe('encryptExistingCpfs', () => {
  it('cifra CPF em texto puro de contas e pedidos e grava o carimbo na conta', async () => {
    prisma().user.findMany.mockResolvedValue([{ id: 'u1', cpf: '52998224725', cpfHash: null }] as never);
    prisma().order.findMany.mockResolvedValue([{ id: 'o1', customerCpf: '39053344705' }] as never);
    const result = await encryptExistingCpfs(prisma());
    const u = prisma().user.update.mock.calls[0][0] as { where: { id: string }; data: { cpf: string; cpfHash: string } };
    expect(u.where.id).toBe('u1');
    expect(openCpf(u.data.cpf)).toBe('52998224725');
    expect(u.data.cpf).not.toContain('52998224725');
    expect(u.data.cpfHash).toBe(sealCpf('52998224725').cpfHash);
    const o = prisma().order.update.mock.calls[0][0] as { data: { customerCpf: string } };
    expect(openCpf(o.data.customerCpf)).toBe('39053344705');
    expect(result).toEqual({ users: 1, orders: 1, cleaned: 0 });
  });

  it('é idempotente: o que já está cifrado não é tocado', async () => {
    prisma().user.findMany.mockResolvedValue([{ id: 'u1', cpf: sealCpf('52998224725').cpf, cpfHash: 'x' }] as never);
    prisma().order.findMany.mockResolvedValue([{ id: 'o1', customerCpf: sealCpf('39053344705').cpf }] as never);
    const result = await encryptExistingCpfs(prisma());
    expect(prisma().user.update).not.toHaveBeenCalled();
    expect(prisma().order.update).not.toHaveBeenCalled();
    expect(result).toEqual({ users: 0, orders: 0, cleaned: 0 });
  });

  it('conta sem CPF ou com o marcador antigo da equipe fica com CPF vazio e sem carimbo', async () => {
    prisma().user.findMany.mockResolvedValue([
      { id: 'u1', cpf: '', cpfHash: null },
      { id: 'u2', cpf: 'equipe-123e4567-e89b-12d3-a456-426614174000', cpfHash: null },
    ] as never);
    prisma().order.findMany.mockResolvedValue([] as never);
    const result = await encryptExistingCpfs(prisma());
    expect(prisma().user.update).toHaveBeenCalledTimes(1);
    expect(prisma().user.update).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { cpf: '', cpfHash: null } });
    expect(result).toEqual({ users: 0, orders: 0, cleaned: 1 });
  });

  it('valor que não é um CPF (nem cifrado) não é inventado: é contado e pulado', async () => {
    prisma().user.findMany.mockResolvedValue([{ id: 'u1', cpf: 'lixo', cpfHash: null }] as never);
    prisma().order.findMany.mockResolvedValue([] as never);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await encryptExistingCpfs(prisma());
    expect(prisma().user.update).not.toHaveBeenCalled();
    expect(result).toEqual({ users: 0, orders: 0, cleaned: 0 });
  });
});
