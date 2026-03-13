ALTER TABLE `informacion_sociodemografica`
ADD COLUMN `rolFamiliar_tmp` JSON NULL;

UPDATE `informacion_sociodemografica`
SET `rolFamiliar_tmp` = JSON_ARRAY(`rolFamiliar`);

ALTER TABLE `informacion_sociodemografica`
DROP COLUMN `rolFamiliar`;

ALTER TABLE `informacion_sociodemografica`
CHANGE COLUMN `rolFamiliar_tmp` `rolFamiliar` JSON NOT NULL;
