-- AlterTable
ALTER TABLE `Settings` ADD COLUMN `wholesaleMinPieces` INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN `wholesaleNotes` TEXT NULL;

-- CreateTable
CREATE TABLE `WholesaleQuote` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `name` VARCHAR(191) NOT NULL,
    `company` VARCHAR(191) NOT NULL DEFAULT '',
    `cnpj` VARCHAR(191) NOT NULL DEFAULT '',
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `interests` VARCHAR(191) NOT NULL DEFAULT '',
    `estimatedPieces` INTEGER NULL,
    `message` TEXT NULL,
    `handled` BOOLEAN NOT NULL DEFAULT false,

    INDEX `WholesaleQuote_handled_createdAt_idx`(`handled`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

