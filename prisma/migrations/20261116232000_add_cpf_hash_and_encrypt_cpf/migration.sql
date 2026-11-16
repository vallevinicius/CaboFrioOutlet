-- O CPF passa a ser guardado cifrado (AES-256-GCM, feito pela aplicação). Texto cifrado muda a cada vez
-- (IV aleatório), então a unicidade sai da coluna `cpf` e vai para um carimbo (HMAC) do CPF, `cpfHash`.
-- Os valores já existentes são cifrados depois, com `npm run db:encrypt-cpf`.

-- DropIndex
DROP INDEX `User_cpf_key` ON `User`;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `cpfHash` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_cpfHash_key` ON `User`(`cpfHash`);
