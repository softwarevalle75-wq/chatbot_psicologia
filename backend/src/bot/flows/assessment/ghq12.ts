/**
 * Procesamiento del cuestionario GHQ-12.
 *
 * Correcciones:
 * - Variable global `globalProvider` eliminada — el provider se pasa al bot/app.ts
 * - Usa el nuevo schema (PsychEvaluation) a través de queries.ts
 * - guardarInformePdfEnBD eliminado (los PDFs ya no se guardan como BLOB en BD)
 */

import {
  getEstadoCuestionario,
  saveEstadoCuestionario,
  savePuntajeUsuario,
  obtenerPerfilPacienteParaInforme,
} from "../../queries/queries.js";
import { interpretPsychologicalTest } from "../../rag/index.js";
import { generateInterpretationPdf } from "./reportPdf.js";
import { guardarRutaPdf } from "../../helpers/pdfStore.js";

// ---------------------------------------------------------------------------
// Preguntas del GHQ-12
// ---------------------------------------------------------------------------

const PREGUNTAS: string[] = [
  "1. ¿Ha podido concentrarse bien en lo que hace?\n    0️⃣ Mejor que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos que lo habitual.\n    3️⃣ Mucho menos que lo habitual.",
  "2. ¿Sus preocupaciones le han hecho perder mucho el sueño?\n    0️⃣ No, en absoluto.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.",
  "3. ¿Ha sentido que está desempeñando un papel útil en la vida?\n    0️⃣ Más que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos que lo habitual.\n    3️⃣ Mucho menos que lo habitual.",
  "4. ¿Se ha sentido capaz de tomar decisiones?\n    0️⃣ Más capaz que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos capaz que lo habitual.\n    3️⃣ Mucho menos capaz que lo habitual.",
  "5. ¿Se ha sentido constantemente agobiado y en tensión?\n    0️⃣ No, en absoluto.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.",
  "6. ¿Ha sentido que no puede superar sus dificultades?\n    0️⃣ No, en absoluto.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.",
  "7. ¿Ha sido capaz de disfrutar de sus actividades normales de cada día?\n    0️⃣ Más que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos que lo habitual.\n    3️⃣ Mucho menos que lo habitual.",
  "8. ¿Ha sido capaz de hacer frente adecuadamente a sus problemas?\n    0️⃣ Más capaz que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos capaz que lo habitual.\n    3️⃣ Mucho menos capaz que lo habitual.",
  "9. ¿Se ha sentido poco feliz o deprimido/a?\n    0️⃣ No, en absoluto.\n    1️⃣ No más que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.",
  "10. ¿Ha perdido confianza en sí mismo/a?\n    0️⃣ No, en absoluto.\n    1️⃣ No más que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.",
  "11. ¿Ha pensado que usted es una persona que no vale para nada?\n    0️⃣ No, en absoluto.\n    1️⃣ No más que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.",
  "12. ¿Se siente razonablemente feliz considerando todas las circunstancias?\n    0️⃣ Más feliz que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos feliz que lo habitual.\n    3️⃣ Mucho menos feliz que lo habitual.",
];

const TOTAL_PREGUNTAS = 12;
export const GHQ12_HIGH_THRESHOLD = Number(process.env.GHQ12_HIGH_THRESHOLD ?? 12);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function calcularPuntajeGHQ12(rawResults: Record<number, number[]>): number {
  let total = 0;
  for (const score of [0, 1, 2, 3]) {
    const items = Array.isArray(rawResults?.[score]) ? rawResults[score] : [];
    total += score * items.length;
  }
  return total;
}

function esRespuestaValida(respuesta: string): boolean {
  return ["0", "1", "2", "3"].includes(respuesta?.trim());
}

function preguntaActualIndex(estado: { preguntaActual: number }): number {
  return estado.preguntaActual;
}

// ---------------------------------------------------------------------------
// Procesamiento principal
// ---------------------------------------------------------------------------

export async function procesarGHQ12(
  numeroUsuario: string,
  respuesta: string | null
): Promise<string | { completed: boolean; recomendarDass21: boolean; message: string } | { error: string }> {
  try {
    const estado = await getEstadoCuestionario(numeroUsuario, "ghq12");
    const resPreg: Record<number, number[]> = (estado.resPreg as Record<number, number[]>) ?? { 0: [], 1: [], 2: [], 3: [] };
    let puntaje = estado.Puntaje ?? 0;
    let preguntaActual = estado.preguntaActual ?? 0;

    // Primera llamada (sin respuesta) → mostrar primera pregunta
    if (respuesta === null) {
      const pregunta = PREGUNTAS[0];
      await saveEstadoCuestionario(numeroUsuario, 0, 0, { 0: [], 1: [], 2: [], 3: [] }, "ghq12");
      return pregunta;
    }

    const respuestaLimpia = respuesta.trim();
    if (!esRespuestaValida(respuestaLimpia)) {
      const pregunta = PREGUNTAS[preguntaActual] ?? PREGUNTAS[0];
      return `❌ Respuesta no válida. Por favor responde con 0, 1, 2 o 3.\n\n${pregunta}`;
    }

    // Registrar respuesta
    const scoreNum = parseInt(respuestaLimpia, 10);
    if (!Array.isArray(resPreg[scoreNum])) resPreg[scoreNum] = [];
    resPreg[scoreNum].push(preguntaActual + 1);
    puntaje += scoreNum;
    preguntaActual++;

    // ¿Hay más preguntas?
    if (preguntaActual < TOTAL_PREGUNTAS) {
      await saveEstadoCuestionario(numeroUsuario, puntaje, preguntaActual, resPreg, "ghq12");
      return PREGUNTAS[preguntaActual];
    }

    // Cuestionario completado
    await savePuntajeUsuario(numeroUsuario, puntaje, resPreg, "ghq12");

    const recomendarDass21 = puntaje >= GHQ12_HIGH_THRESHOLD;
    const nivelRiesgo = puntaje >= 20 ? "alto" : puntaje >= GHQ12_HIGH_THRESHOLD ? "moderado" : "bajo";
    const mensajeRiesgo =
      nivelRiesgo === "alto"
        ? "⚠️ Se detectó un nivel *alto* de malestar psicológico."
        : nivelRiesgo === "moderado"
        ? "🔶 Se detectó un nivel *moderado* de malestar."
        : "✅ Los resultados están dentro de parámetros normales.";

    const mensajeRecomendacion = recomendarDass21
      ? "\n\n🔬 Se recomienda complementar con el *DASS-21* para mayor precisión diagnóstica."
      : "";

    // Generar informe en segundo plano (no bloquea la respuesta)
    generarInformeGHQ12Async(numeroUsuario, resPreg).catch((e) =>
      console.error("[GHQ-12] Error generando informe:", e)
    );

    return {
      completed: true,
      recomendarDass21,
      message:
        `✅ *GHQ-12 completado*\n\n` +
        `📊 Puntaje total: *${puntaje}*\n` +
        `${mensajeRiesgo}${mensajeRecomendacion}\n\n` +
        `📄 Generando informe detallado...`,
    };
  } catch (error) {
    console.error("[GHQ-12] Error en procesarGHQ12:", error);
    return { error: "Hubo un error al procesar el cuestionario. Por favor, intenta de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Generación asíncrona del informe
// ---------------------------------------------------------------------------

async function generarInformeGHQ12Async(
  numeroUsuario: string,
  rawResults: Record<number, number[]>
): Promise<void> {
  try {
    console.log(`[GHQ-12] Generando informe para ${numeroUsuario}...`);
    const patientData = await obtenerPerfilPacienteParaInforme(numeroUsuario);

    const interpretacion = await interpretPsychologicalTest("ghq12", rawResults, numeroUsuario);

    if (!interpretacion.success) {
      console.error("[GHQ-12] Error en interpretación RAG:", interpretacion.metadata);
      return;
    }

    const pdfPath = await generateInterpretationPdf({
      numeroUsuario,
      testId: "ghq12",
      interpretation: interpretacion.interpretation,
      rawResults,
      patientData,
    });

    guardarRutaPdf(numeroUsuario, pdfPath, "ghq12");
    console.log(`[GHQ-12] Informe generado: ${pdfPath}`);
  } catch (error) {
    console.error("[GHQ-12] Error generando informe:", error);
  }
}

// ---------------------------------------------------------------------------
// Metadata del test
// ---------------------------------------------------------------------------

export function GHQ12info() {
  return {
    nombre:         "GHQ-12",
    descripcion:    "Cuestionario de Salud General de 12 ítems",
    numPreguntas:   12,
    tiempoEstimado: "5-10 minutos",
  };
}
