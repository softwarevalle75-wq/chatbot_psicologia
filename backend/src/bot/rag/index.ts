/**
 * Punto de entrada del módulo RAG.
 * Exporta las funciones públicas necesarias para el bot.
 */

export { initializeRAG, reindexAll }           from "./processor.js";
export { interpretPsychologicalTest,
         PsychologicalInterpretationResult }   from "./interpreter.js";
export { getRagConfig, guardarResultadoPrueba } from "./config.js";
export { TEST_SOURCES, getEnabledSources }      from "./sources.js";
export { retrieveImproved, retrieve }           from "./retriever.js";
export { generateAnswer, GenerationResult }     from "./generator.js";
