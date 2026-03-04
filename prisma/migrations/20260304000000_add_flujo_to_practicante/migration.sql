-- AlterTable practicante: agregar campo flujo para tracking de estado del practicante
-- Necesario para que el capture de practEsperarResultados pueda saber desde BD
-- si el test del paciente terminó, sin depender del state en memoria de BuilderBot.
ALTER TABLE `practicante`
    ADD COLUMN `flujo` VARCHAR(191) NOT NULL DEFAULT 'practMenuFlow';
