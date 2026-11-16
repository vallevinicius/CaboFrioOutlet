import type { PrismaClient } from '@prisma/client';
import { sealCpf } from '../utils/cpf-vault.js';
import { isValidCpf } from '../utils/cpf.js';

const ENCRYPTED_PREFIX = 'enc:v1:';
const STAFF_PLACEHOLDER_PREFIX = 'equipe-';

export interface CpfMigrationResult {
  /** Contas cujo CPF foi cifrado agora. */
  users: number;
  /** Pedidos cujo CPF foi cifrado agora. */
  orders: number;
  /** Contas da equipe com o marcador antigo, limpas para CPF vazio. */
  cleaned: number;
}

/**
 * Cifra os CPFs que ainda estão em texto puro (contas e pedidos) e grava o carimbo de unicidade.
 * Pode rodar quantas vezes quiser: o que já está cifrado é pulado. Valor que não é CPF é avisado e
 * deixado como está (nada é inventado nem apagado).
 */
export async function encryptExistingCpfs(db: PrismaClient): Promise<CpfMigrationResult> {
  const result: CpfMigrationResult = { users: 0, orders: 0, cleaned: 0 };

  const users = await db.user.findMany({ select: { id: true, cpf: true, cpfHash: true } });
  for (const user of users) {
    if (!user.cpf || user.cpf.startsWith(ENCRYPTED_PREFIX)) continue;
    if (user.cpf.startsWith(STAFF_PLACEHOLDER_PREFIX)) {
      await db.user.update({ where: { id: user.id }, data: { cpf: '', cpfHash: null } });
      result.cleaned++;
      continue;
    }
    if (!isValidCpf(user.cpf)) {
      console.warn(`[cpf] conta ${user.id}: valor que não é um CPF válido, deixado como está.`);
      continue;
    }
    const sealed = sealCpf(user.cpf);
    await db.user.update({ where: { id: user.id }, data: { cpf: sealed.cpf, cpfHash: sealed.cpfHash } });
    result.users++;
  }

  const orders = await db.order.findMany({ where: { customerCpf: { not: null } }, select: { id: true, customerCpf: true } });
  for (const order of orders) {
    if (!order.customerCpf || order.customerCpf.startsWith(ENCRYPTED_PREFIX)) continue;
    if (!isValidCpf(order.customerCpf)) {
      console.warn(`[cpf] pedido ${order.id}: valor que não é um CPF válido, deixado como está.`);
      continue;
    }
    await db.order.update({ where: { id: order.id }, data: { customerCpf: sealCpf(order.customerCpf).cpf } });
    result.orders++;
  }

  return result;
}
