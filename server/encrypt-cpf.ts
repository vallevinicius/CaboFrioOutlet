import './env.js';
import { prisma } from './db.js';
import { encryptExistingCpfs } from './services/cpf-migration.js';

/**
 * Cifra os CPFs que ainda estão em texto puro no banco (contas e pedidos).
 * Rode uma vez depois do deploy (npm run db:encrypt-cpf). É seguro rodar de novo: pula o que já está cifrado.
 */
async function main() {
  const result = await encryptExistingCpfs(prisma);
  console.log(`CPFs cifrados: ${result.users} conta(s), ${result.orders} pedido(s). Contas da equipe limpas: ${result.cleaned}.`);
}

main()
  .catch((err) => {
    console.error('Falha ao cifrar os CPFs:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
