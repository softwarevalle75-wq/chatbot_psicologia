CREATE TABLE IF NOT EXISTS `envios_correo` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `telefono_paciente` VARCHAR(191) NOT NULL,
  `correo_practicante` VARCHAR(191) NOT NULL,
  `nombre_practicante` VARCHAR(191) NULL,
  `test_tipo` VARCHAR(32) NOT NULL DEFAULT 'otro',
  `test_nombre` VARCHAR(191) NULL,
  `pdf_nombre` VARCHAR(512) NULL,
  `message_id` VARCHAR(512) NULL,
  `fecha_envio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

  PRIMARY KEY (`id`),
  INDEX `idx_envios_correo_telefono`(`telefono_paciente`),
  INDEX `idx_envios_correo_correo`(`correo_practicante`),
  INDEX `idx_envios_correo_fecha`(`fecha_envio`),
  INDEX `idx_envios_correo_test`(`test_tipo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
