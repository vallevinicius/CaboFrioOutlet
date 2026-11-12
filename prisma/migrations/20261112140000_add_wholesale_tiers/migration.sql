-- AlterTable
ALTER TABLE `Order` ADD COLUMN `isWholesale` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `wholesaleDiscountPercent` DOUBLE NULL;

-- AlterTable
ALTER TABLE `Settings` ADD COLUMN `wholesaleTiers` TEXT NULL;

-- AlterTable
ALTER TABLE `WholesaleQuote` ADD COLUMN `discountPercent` DOUBLE NULL,
    ADD COLUMN `estimatedTotal` DOUBLE NULL,
    ADD COLUMN `items` JSON NULL;

