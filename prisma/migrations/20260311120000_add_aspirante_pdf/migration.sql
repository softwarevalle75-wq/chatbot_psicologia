-- AlterTable
ALTER TABLE `informacionUsuario`
ADD COLUMN `pdfAspirante` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `aspirante` (
    `idAspirante` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NOT NULL,
    `documento` VARCHAR(191) NULL,
    `pdfRuta` VARCHAR(191) NOT NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'aspirante',
    `fechaCreacion` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `fechaActualizacion` DATETIME(0) NOT NULL,

    UNIQUE INDEX `aspirante_usuarioId_key`(`usuarioId`),
    INDEX `aspirante_telefono_idx`(`telefono`),
    PRIMARY KEY (`idAspirante`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `aspirante`
ADD CONSTRAINT `aspirante_usuarioId_fkey`
FOREIGN KEY (`usuarioId`) REFERENCES `informacionUsuario`(`idUsuario`)
ON DELETE CASCADE ON UPDATE CASCADE;
