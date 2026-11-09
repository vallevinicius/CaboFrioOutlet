-- AlterTable
ALTER TABLE `Settings` ADD COLUMN `storyBody` TEXT NULL,
    ADD COLUMN `storyTitle` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `tickerMessages` TEXT NULL;

