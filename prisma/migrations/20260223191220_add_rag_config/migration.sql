-- CreateTable
CREATE TABLE `rag_psychological_config` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'general',
    `systemInstructions` TEXT NOT NULL,
    `promptTemplate` TEXT NOT NULL,
    `metadata` JSON NULL,
    `version` VARCHAR(191) NOT NULL DEFAULT '1.0',
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
