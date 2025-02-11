-- AddForeignKey
ALTER TABLE `buyers` ADD CONSTRAINT `buyers_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
