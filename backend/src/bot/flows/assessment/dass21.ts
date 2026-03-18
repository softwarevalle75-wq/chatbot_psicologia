/**
 * Procesamiento del cuestionario DASS-21.
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
// Preguntas DASS-21
// ---------------------------------------------------------------------------

const PREGUNTAS: string[] = [
  "1. Me costó mucho relajarme\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "2. Me di cuenta que tenía la boca seca\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "3. No podía sentir ningún sentimiento positivo\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "4. Se me hizo difícil respirar\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "5. Se me hizo difícil tomar la iniciativa para hacer cosas\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "6. Reaccioné exageradamente en ciertas situaciones\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "7. Sentí que mis manos temblaban\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "8. Sentí que tenía muchos nervios\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "9. Estaba preocupado por situaciones en las cuales podía entrar en pánico\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "10. Sentí que no había nada que me ilusionara\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "11. Me sentí agitado\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "12. Se me hizo difícil relajarme\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "13. Me sentí triste y deprimido\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "14. No toleré nada que me impidiera continuar con lo que estaba haciendo\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "15. Sentí que estaba al punto de pánico\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "16. No me pude entusiasmar por nada\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "17. Sentí que valía muy poco como persona\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "18. Sentí que estaba muy irritable\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "19. Sentí los latidos de mi corazón a pesar de no haber hecho ningún esfuerzo físico\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "20. Tuve miedo sin razón\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
  "21. Sentí que la vida no tenía sentido\n    0️⃣ No me aplicó en absoluto.\n    1️⃣ Me aplicó un poco, o durante parte del tiempo.\n    2️⃣ Me aplicó bastante, o durante una buena parte del tiempo.\n    3️⃣ Me aplicó mucho, o la mayor parte del tiempo.",
];

const TOTAL_PREGUNTAS = 21;

// ---------------------------------------------------------------------------
// Procesamiento principal
// ---------------------------------------------------------------------------

export async function procesarDass21(
  numeroUsuario: string,
  respuesta: string | null
): Promise<string | { completed: boolean; message: string } | { error: string }> {
  try {
    const estado = await getEstadoCuestionario(numeroUsuario, "dass21");
    const resPreg: Record<number, number[]> = (estado.resPreg as Record<number, number[]>) ?? { 0: [], 1: [], 2: [], 3: [] };
    let puntaje = estado.Puntaje ?? 0;
    let preguntaActual = estado.preguntaActual ?? 0;

    if (respuesta === null) {
      await saveEstadoCuestionario(numeroUsuario, 0, 0, { 0: [], 1: [], 2: [], 3: [] }, "dass21");
      return PREGUNTAS[0];
    }

    const respuestaLimpia = respuesta.trim();
    if (!["0", "1", "2", "3"].includes(respuestaLimpia)) {
      return `❌ Respuesta no válida. Por favor responde con 0, 1, 2 o 3.\n\n${PREGUNTAS[preguntaActual] ?? PREGUNTAS[0]}`;
    }

    const scoreNum = parseInt(respuestaLimpia, 10);
    if (!Array.isArray(resPreg[scoreNum])) resPreg[scoreNum] = [];
    resPreg[scoreNum].push(preguntaActual + 1);
    puntaje += scoreNum;
    preguntaActual++;

    if (preguntaActual < TOTAL_PREGUNTAS) {
      await saveEstadoCuestionario(numeroUsuario, puntaje, preguntaActual, resPreg, "dass21");
      return PREGUNTAS[preguntaActual];
    }

    // Completado
    await savePuntajeUsuario(numeroUsuario, puntaje, resPreg, "dass21");

    generarInformeDASS21Async(numeroUsuario, resPreg).catch((e) =>
      console.error("[DASS-21] Error generando informe:", e)
    );

    return {
      completed: true,
      message:
        `✅ *DASS-21 completado*\n\n` +
        `📊 Puntaje total: *${puntaje}*\n\n` +
        `📄 Generando informe detallado...`,
    };
  } catch (error) {
    console.error("[DASS-21] Error:", error);
    return { error: "Hubo un error al procesar el cuestionario. Por favor, intenta de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Generación asíncrona del informe
// ---------------------------------------------------------------------------

async function generarInformeDASS21Async(
  numeroUsuario: string,
  rawResults: Record<number, number[]>
): Promise<void> {
  try {
    console.log(`[DASS-21] Generando informe para ${numeroUsuario}...`);
    const patientData = await obtenerPerfilPacienteParaInforme(numeroUsuario);
    const interpretacion = await interpretPsychologicalTest("dass21", rawResults, numeroUsuario);

    if (!interpretacion.success) {
      console.error("[DASS-21] Error en interpretación RAG");
      return;
    }

    const pdfPath = await generateInterpretationPdf({
      numeroUsuario,
      testId: "dass21",
      interpretation: interpretacion.interpretation,
      rawResults,
      patientData,
    });

    guardarRutaPdf(numeroUsuario, pdfPath, "dass21");
    console.log(`[DASS-21] Informe generado: ${pdfPath}`);
  } catch (error) {
    console.error("[DASS-21] Error generando informe:", error);
  }
}

export function DASS21info() {
  return {
    nombre:         "DASS-21",
    descripcion:    "Escala de Depresión, Ansiedad y Estrés",
    numPreguntas:   21,
    tiempoEstimado: "10-15 minutos",
  };
}
