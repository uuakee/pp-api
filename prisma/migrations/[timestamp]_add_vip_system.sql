-- Primeiro adicionamos as colunas com valores padrão
ALTER TABLE `plans` ADD COLUMN `image` VARCHAR(191) NOT NULL DEFAULT 'default_image.jpg';
ALTER TABLE `plans` ADD COLUMN `loops` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `plans` ADD COLUMN `vip_needed` ENUM('VIP_0', 'VIP_1', 'VIP_2', 'VIP_3') NOT NULL DEFAULT 'VIP_0';

-- Depois removemos os valores padrão para manter a estrutura do schema
ALTER TABLE `plans` ALTER COLUMN `image` DROP DEFAULT;
ALTER TABLE `plans` ALTER COLUMN `loops` DROP DEFAULT;
ALTER TABLE `plans` ALTER COLUMN `vip_needed` DROP DEFAULT; 