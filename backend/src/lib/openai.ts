/**
 * Singleton de OpenAI.
 * Un único cliente compartido por todos los módulos del backend y del bot.
 * Evita instanciar múltiples clientes que consumen recursos innecesariamente.
 */

import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "[OpenAI] Variable OPENAI_API_KEY no definida. Revisa tu archivo .env."
  );
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
