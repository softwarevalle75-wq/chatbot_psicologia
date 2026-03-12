-- AlterTable
ALTER TABLE `informacionUsuario`
ADD COLUMN `sexo` VARCHAR(191) NOT NULL DEFAULT 'No informa',
ADD COLUMN `identidadGenero` VARCHAR(191) NOT NULL DEFAULT 'No informa',
ADD COLUMN `discapacidad` VARCHAR(191) NOT NULL DEFAULT 'No';
