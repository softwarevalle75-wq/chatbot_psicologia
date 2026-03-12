-- AlterTable
ALTER TABLE `informacionUsuario`
ADD COLUMN `orientacionSexual` VARCHAR(191) NOT NULL DEFAULT 'Prefiero no decir',
ADD COLUMN `etnia` VARCHAR(191) NOT NULL DEFAULT 'Prefiero no decir';
