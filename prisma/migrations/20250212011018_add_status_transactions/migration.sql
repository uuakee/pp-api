-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `status` ENUM('waiting_payment', 'pending', 'approved', 'refused') NOT NULL DEFAULT 'waiting_payment';
