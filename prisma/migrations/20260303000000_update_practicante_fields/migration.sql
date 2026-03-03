-- AlterTable practicante
-- 1. Renombrar sesiones → citasProgramadas
ALTER TABLE `practicante` RENAME COLUMN `sesiones` TO `citasProgramadas`;

-- 2. Hacer opcionales los campos legacy que antes eran NOT NULL
ALTER TABLE `practicante`
    MODIFY COLUMN `estrato`   VARCHAR(191) NULL,
    MODIFY COLUMN `barrio`    VARCHAR(191) NULL,
    MODIFY COLUMN `localidad` VARCHAR(191) NULL;

-- 3. Agregar campos nuevos
ALTER TABLE `practicante`
    ADD COLUMN `correo`      VARCHAR(191) NULL,
    ADD COLUMN `eps_ips`     VARCHAR(191) NULL,
    ADD COLUMN `clinica`     VARCHAR(191) NULL,
    ADD COLUMN `fechaInicio` DATE         NULL,
    ADD COLUMN `fechaFin`    DATE         NULL;

-- 4. Índice único sobre correo
CREATE UNIQUE INDEX `practicante_correo_key` ON `practicante`(`correo`);
