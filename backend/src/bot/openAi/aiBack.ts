/**
 * Funciones de IA para lógica interna del bot.
 * Usa el singleton openai de lib/openai.ts (no instancia uno propio).
 */

import { openai } from "../../lib/openai.js";

type ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Respuesta de IA con las últimas 6 entradas del historial.
 * Usado para lógica interna donde no es necesario el historial completo.
 */
export async function apiBack(
  conversationHistory: ConversationMessage[],
  action: string
): Promise<string> {
  try {
    const hist = conversationHistory.slice(-6);
    hist.push({ role: "system", content: action });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: hist,
      temperature: 0,
    });

    return completion.choices[0].message.content ?? "";
  } catch (error) {
    console.error("[aiBack] Error al llamar OpenAI:", error);
    throw new Error("Hubo un problema al obtener la respuesta de la IA.");
  }
}

/**
 * Respuesta de IA con el historial completo.
 * Usado cuando se necesita contexto total (ej: evaluación de resultados).
 */
export async function apiBack1(
  conversationHistory: ConversationMessage[],
  action: string
): Promise<string> {
  try {
    const hist = [...conversationHistory];
    hist.push({ role: "system", content: action });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: hist,
      temperature: 0,
    });

    return completion.choices[0].message.content ?? "";
  } catch (error) {
    console.error("[apiBack1] Error al llamar OpenAI:", error);
    throw new Error("Hubo un problema al obtener la respuesta de la IA.");
  }
}
