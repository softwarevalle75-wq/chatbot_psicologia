-- AlterTable
ALTER TABLE `informacionUsuario`
ADD COLUMN `discapacidad` VARCHAR(191) NOT NULL DEFAULT 'No',
ADD COLUMN `discapacidadDetalle` VARCHAR(191) NULL;
