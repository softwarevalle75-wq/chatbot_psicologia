/**
 * Control de cuestionarios disponibles.
 */

export const TIPOS_TEST = {
  GHQ12:  "ghq12",
  DASS21: "dass21",
} as const;

export type TipoTest = (typeof TIPOS_TEST)[keyof typeof TIPOS_TEST];

export const menuCuestionarios = (allowDass21 = false): string => {
  const dassBlock = allowDass21
    ? `\n2️⃣  *DASS-21*\n   Escala de Depresión, Ansiedad y Estrés\n   • Tiempo estimado: 10-15 minutos\n   • Nº de preguntas: 21\n`
    : "";

  const selectionHint = allowDass21
    ? "👉 *Responde con _1_ o _2_* para seleccionar el test que deseas realizar."
    : "👉 *Responde con _1_* para iniciar GHQ-12.";

  return `
═════════════════════════
 🧠 *CUESTIONARIOS DISPONIBLES*
═════════════════════════

1️⃣  *GHQ-12*
   Cuestionario de Salud General de 12 ítems
   • Tiempo estimado: 5-10 minutos
   • Nº de preguntas: 12

${dassBlock}
───────────────────────────────
${selectionHint}`;
};

export const parsearSeleccionTest = (
  seleccion: string,
  allowDass21 = false
): TipoTest | null => {
  switch (seleccion.trim()) {
    case "1": return "ghq12";
    case "2": return allowDass21 ? "dass21" : null;
    default:  return null;
  }
};
