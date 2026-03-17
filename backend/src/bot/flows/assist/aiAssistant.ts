/**
 * Asistente de IA empático — único punto de uso de IA conversacional en el bot.
 *
 * Correcciones sobre Developer:
 * - Eliminada variable `let c = 0` a nivel de módulo (era compartida entre todos
 *   los usuarios simultáneos, causando comportamiento incorrecto).
 *   Ahora el contador de mensajes vive en Patient.helpStage (BD), por usuario.
 * - Eliminado axios.post('http://localhost:3000/...') hardcodeado.
 *   La transición al testFlow se devuelve como señal al caller (return true).
 * - Usa el singleton openai de lib/openai.ts en lugar de instanciar uno propio.
 */

import { openai } from "../../../lib/openai.js";
import { obtenerHist, saveHist, switchAyudaPsicologica } from "../../queries/queries.js";
import { assistantPrompt } from "../../openAi/prompts.js";
import { apiBack } from "../../openAi/aiBack.js";

type ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAiTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
  strict?: boolean;
};

// ---------------------------------------------------------------------------

async function cambiarEstado(numero: string, hist: ConversationMessage[]) {
  const raw = await apiBack(
    hist,
    `Devuelve "1" si el usuario NO quiere ayuda. Si SÍ quiere ayuda devuelve "2".
    IMPORTANTE: SOLO devuelve el número, sin texto adicional.`
  );
  const opcion = parseInt(raw ?? "1", 10);
  await switchAyudaPsicologica(numero, opcion);
  return { success: true, result: opcion };
}

// ---------------------------------------------------------------------------

const tools: OpenAiTool[] = [
  {
    type: "function",
    function: {
      name: "cambiarEstado",
      description: `
        IMPORTANTE: Esta función SOLO debe llamarse cuando:
        1. El usuario esté interesado en recibir ayuda psicológica.
        2. El usuario mencione que quiere una cita de psicología.

        NO llamar esta función:
        - Si el usuario solo está conversando normalmente.
        - Si menciona psicología sin pedir ayuda directamente.
      `,
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

// ---------------------------------------------------------------------------

/**
 * Asistente empático con detección de intención de ayuda psicológica.
 * El HELP_THRESHOLD controla cada cuántos mensajes se sugiere la ayuda.
 *
 * @returns string con la respuesta, o `true` si el usuario quiere ayuda
 *          (señal para que el flow redirija al testFlow)
 */
const HELP_THRESHOLD = 3;

export async function apiAssistant1(
  numero: string,
  msg: string,
  helpStage: number
): Promise<string | true> {
  const conversationHistory = (await obtenerHist(numero)) as ConversationMessage[];

  conversationHistory.unshift({
    role: "system",
    content: assistantPrompt,
  });

  // Sugerir ayuda psicológica cuando el contador del usuario (por BD) llega al umbral
  if (helpStage >= HELP_THRESHOLD) {
    conversationHistory.push({
      role: "system",
      content: `IMPORTANTE: Debes preguntar al usuario si quiere recibir ayuda psicológica profesional.`,
    });
  }

  conversationHistory.push({ role: "user", content: msg });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversationHistory as Parameters<typeof openai.chat.completions.create>[0]["messages"],
      tools: tools as Parameters<typeof openai.chat.completions.create>[0]["tools"],
      tool_choice: "auto",
    });

    const assistantMessage = response.choices[0].message.content;
    const toolCalls = response.choices[0].message.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      for (const call of toolCalls) {
        if (call.type === "function" && call.function.name === "cambiarEstado") {
          await cambiarEstado(numero, conversationHistory);
          // Devuelve true como señal — el welcomeFlow redirige al testFlow
          return true;
        }
      }
    }

    // Guardar historial sin el system prompt (no persistir en BD)
    conversationHistory.push({ role: "assistant", content: assistantMessage ?? "" });
    conversationHistory.shift(); // elimina el system prompt del inicio
    await saveHist(numero, conversationHistory);

    return assistantMessage ?? "";
  } catch (error) {
    console.error("[aiAssistant] Error al llamar OpenAI:", error);
    throw new Error("Hubo un error al procesar la solicitud del asistente.");
  }
}

/**
 * Asistente simple — sin tool calls ni lógica de detección.
 * Usado cuando el usuario ya está en un estado avanzado del flujo.
 */
export async function apiAssistant2(
  numero: string,
  msg: string
): Promise<string> {
  const conversationHistory = (await obtenerHist(numero)) as ConversationMessage[];
  conversationHistory.unshift({ role: "system", content: assistantPrompt });
  conversationHistory.push({ role: "user", content: msg });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversationHistory as Parameters<typeof openai.chat.completions.create>[0]["messages"],
    });

    const assistantMessage = response.choices[0].message.content ?? "";
    conversationHistory.push({ role: "assistant", content: assistantMessage });
    conversationHistory.shift();
    await saveHist(numero, conversationHistory);

    return assistantMessage;
  } catch (error) {
    console.error("[aiAssistant2] Error al llamar OpenAI:", error);
    throw new Error("Hubo un error al procesar la solicitud del asistente.");
  }
}
