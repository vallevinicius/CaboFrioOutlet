-- AlterTable
ALTER TABLE `Order` ADD COLUMN `shippingCost` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Settings` ADD COLUMN `shippingFee` DOUBLE NOT NULL DEFAULT 19.9;
