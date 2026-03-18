/**
 * Configuración RAG desde la base de datos.
 */

import { prisma } from "../../database/prisma.js";

export interface RagConfig {
  id:                 string;
  systemInstructions: string;
  promptTemplate:     string;
  version:            string;
  metadata:           unknown;
}

/**
 * Obtiene la configuración RAG desde la BD.
 * Lanza error si no existe — debe inicializarse con el seeder.
 */
export async function getRagConfig(): Promise<RagConfig> {
  const config = await prisma.ragConfig.findUnique({ where: { id: "general" } });

  if (!config) {
    throw new Error(
      "[RAG] Configuración RAG no encontrada en la BD. " +
      "Ejecuta: node database/seeders/seed-rag-config.mjs"
    );
  }

  return config as unknown as RagConfig;
}

/**
 * Guarda el resultado de una evaluación psicológica.
 * Adaptado al nuevo schema PostgreSQL: PsychEvaluation (ya existe con patientId).
 */
export async function guardarResultadoPrueba(
  patientId:     string,
  tipoTest:      string,
  datosResultados: string
): Promise<void> {
  try {
    // Buscar evaluación existente por patientId y tipo
    const existing = await prisma.psychEvaluation.findFirst({
      where: { patientId, type: tipoTest },
    });

    if (existing) {
      await prisma.psychEvaluation.update({
        where: { id: existing.id },
        data:  { result: datosResultados, completed: true },
      });
    } else {
      await prisma.psychEvaluation.create({
        data: {
          patientId,
          type:      tipoTest,
          result:    datosResultados,
          completed: true,
          responses: {},
        },
      });
    }

    console.log(`[RAG] Resultado guardado para paciente ${patientId} — test: ${tipoTest}`);
  } catch (error) {
    // No es error crítico — loguear y continuar
    console.error(`[RAG] Error al guardar resultado para ${patientId} en ${tipoTest}:`, error);
  }
}
