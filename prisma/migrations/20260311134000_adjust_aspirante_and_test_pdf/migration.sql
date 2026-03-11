-- AlterTable
ALTER TABLE `informacionUsuario`
DROP COLUMN `pdfAspirante`;

-- AlterTable
ALTER TABLE `aspirante`
DROP COLUMN `pdfRuta`;

-- AlterTable
ALTER TABLE `ghq12`
ADD COLUMN `informePdf` LONGBLOB NULL,
ADD COLUMN `informePdfNombre` VARCHAR(191) NULL,
ADD COLUMN `informePdfMime` VARCHAR(191) NULL,
ADD COLUMN `informePdfFecha` DATETIME(0) NULL;

-- AlterTable
ALTER TABLE `dass21`
ADD COLUMN `informePdf` LONGBLOB NULL,
ADD COLUMN `informePdfNombre` VARCHAR(191) NULL,
ADD COLUMN `informePdfMime` VARCHAR(191) NULL,
ADD COLUMN `informePdfFecha` DATETIME(0) NULL;
