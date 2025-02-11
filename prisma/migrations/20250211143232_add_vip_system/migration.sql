/*
  Warnings:

  - You are about to drop the `Plataform` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `price` to the `buyers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `buyers` ADD COLUMN `price` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `plans` ADD COLUMN `image` VARCHAR(191) NOT NULL DEFAULT 'default_image.jpg',
    ADD COLUMN `loops` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `vip_needed` ENUM('VIP_0', 'VIP_1', 'VIP_2', 'VIP_3') NOT NULL DEFAULT 'VIP_0';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `vip_type` ENUM('VIP_0', 'VIP_1', 'VIP_2', 'VIP_3') NULL;

-- DropTable
DROP TABLE `Plataform`;

-- CreateTable
CREATE TABLE `plataform` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `telegram_link` VARCHAR(191) NOT NULL,
    `whatsapp_link` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vips` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` ENUM('VIP_0', 'VIP_1', 'VIP_2', 'VIP_3') NOT NULL,
    `image` VARCHAR(191) NOT NULL,
    `cpa_porcentage` INTEGER NOT NULL,
    `min_investment` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
