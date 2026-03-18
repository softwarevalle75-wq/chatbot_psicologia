/**
 * Generación de respuestas con OpenAI para el RAG.
 */

import { openai } from "../../lib/openai.js";
import type { QdrantResult } from "./reranker.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  systemPrompt:       string;
  userPromptTemplate?: string;
  rawResults?:        Record<number, number[]>;
  patientData?:       Record<string, unknown>;
  itemScores?:        Array<{ item: number; score: number }>;
  reasoningEffort?:   "low" | "medium" | "high";
  maxTokens?:         number;
  openaiOptions?:     Record<string, unknown>;
}

export class GenerationResult {
  constructor(
    public readonly answer:      string,
    public readonly success:     boolean,
    public readonly usedContext: number,
    public readonly metadata:    Record<string, unknown> = {}
  ) {}
}

const MODEL = "gpt-4o-mini";

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

function buildContext(chunks: QdrantResult[]): string {
  if (!chunks || chunks.length === 0) return "No se encontró contexto relevante.";

  const sorted = [...chunks].sort((a, b) => {
    const aP = (a.payload ?? {}) as Record<string, unknown>;
    const bP = (b.payload ?? {}) as Record<string, unknown>;
    if (aP.docId !== bP.docId) return String(aP.docId ?? "").localeCompare(String(bP.docId ?? ""));
    return Number(aP.chunkIndex ?? 0) - Number(bP.chunkIndex ?? 0);
  });

  return sorted
    .map((chunk, i) => {
      const p   = (chunk.payload ?? {}) as Record<string, unknown>;
      const doc = String(p.docName ?? "Sin documento");
      const pg  = p.pageStart ?? "?";
      return `[Chunk ${i + 1} | ${doc} | Página ${pg}]\n${String(chunk.text ?? p.text ?? "")}`;
    })
    .join("\n\n---\n\n");
}

function formatPatientData(patientData?: Record<string, unknown>): string {
  if (!patientData || typeof patientData !== "object") return "No disponible.";
  const keyLabels: Record<string, string> = {
    paciente_id:            "Paciente",
    test_id:                "Prueba",
    total_items_respondidos:"Total de ítems respondidos",
  };
  const lines = Object.entries(patientData)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `- ${keyLabels[k] ?? k}: ${v}`);
  return lines.length > 0 ? lines.join("\n") : "No disponible.";
}

function formatRawResults(rawResults?: Record<number, number[]>, question = ""): string {
  if (!rawResults) return "No se recibieron resultados estructurados.";
  const isGhq   = question.toLowerCase().includes("ghq");
  const isDass   = question.toLowerCase().includes("dass");
  const expected = isGhq ? 12 : isDass ? 21 : null;
  const score0   = Array.isArray(rawResults[0]) ? rawResults[0] : [];
  const score1   = Array.isArray(rawResults[1]) ? rawResults[1] : [];
  const score2   = Array.isArray(rawResults[2]) ? rawResults[2] : [];
  const score3   = Array.isArray(rawResults[3]) ? rawResults[3] : [];
  const total    = score0.length + score1.length + score2.length + score3.length;
  const comp     = expected ? `${total}/${expected} ítems (${total >= expected ? "completo" : "incompleto"})` : `${total} ítems`;

  return [
    `- Protocolo respondido: ${comp}.`,
    "- Distribución por categoría:",
    `  - Categoría 0: ${score0.length} ítems [${score0.join(", ")}]`,
    `  - Categoría 1: ${score1.length} ítems [${score1.join(", ")}]`,
    `  - Categoría 2: ${score2.length} ítems [${score2.join(", ")}]`,
    `  - Categoría 3: ${score3.length} ítems [${score3.join(", ")}]`,
  ].join("\n");
}

function formatItemScores(itemScores?: Array<{ item: number; score: number }>): string {
  if (!Array.isArray(itemScores) || itemScores.length === 0)
    return "No se pudo reconstruir puntaje por ítem.";
  return itemScores.map(({ item, score }) => `- Ítem ${item} = ${score}`).join("\n");
}

function formatQualityChecks(itemScores?: Array<{ item: number; score: number }>, question = ""): string {
  if (!Array.isArray(itemScores) || itemScores.length === 0)
    return "- Sin datos suficientes para control de calidad.";
  const isGhq     = question.toLowerCase().includes("ghq");
  const isDass     = question.toLowerCase().includes("dass");
  const expected   = isGhq ? 12 : isDass ? 21 : null;
  const counts     = new Map<number, number>();
  itemScores.forEach(({ item }) => counts.set(item, (counts.get(item) ?? 0) + 1));
  const duplicated = [...counts.entries()].filter(([, c]) => c > 1).map(([i]) => i);
  const unique     = [...counts.keys()].sort((a, b) => a - b);
  const lines = [
    `- Total de respuestas registradas: ${itemScores.length}.`,
    `- Total de ítems únicos: ${unique.length}.`,
    duplicated.length > 0
      ? `- Ítems duplicados detectados: ${duplicated.join(", ")}.`
      : "- No se detectan ítems duplicados.",
  ];
  if (expected) {
    const missing = Array.from({ length: expected }, (_, i) => i + 1).filter((i) => !counts.has(i));
    lines.push(`- Protocolo esperado: ${expected} ítems.`);
    lines.push(missing.length > 0 ? `- Ítems faltantes: ${missing.join(", ")}.` : "- No se detectan ítems faltantes.");
  }
  return lines.join("\n");
}

function buildPrompt(
  question: string,
  context: string,
  options: GenerateOptions
): Array<{ role: string; content: string }> {
  if (!options.systemPrompt) {
    throw new Error("systemPrompt es requerido — debe provenir de la BD (RagConfig)");
  }

  const template = options.userPromptTemplate ?? [
    "Instrumento: {question}",
    "",
    "Datos del paciente:",
    "{patientData}",
    "",
    "Resultados del paciente:",
    "{rawResults}",
    "",
    "Puntaje por ítem:",
    "{itemScores}",
    "",
    "Contexto normativo recuperado:",
    "{context}",
  ].join("\n");

  const replacements: Record<string, string> = {
    question,
    context,
    rawResults:    formatRawResults(options.rawResults, question),
    patientData:   formatPatientData(options.patientData),
    itemScores:    formatItemScores(options.itemScores),
    qualityChecks: formatQualityChecks(options.itemScores, question),
  };

  let userContent = template;
  for (const [key, value] of Object.entries(replacements)) {
    userContent = userContent.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  return [
    { role: "system", content: options.systemPrompt },
    { role: "user",   content: userContent },
  ];
}

function normalizeAnswer(text = ""): string {
  const lines = String(text).split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  if (lines.length > 0 && /^#\s*informe de interpretaci[oó]n t[eé]cnica\s*$/i.test(lines[0].trim())) {
    lines.shift();
    while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  }
  return lines.join("\n").trim();
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export async function generateAnswer(
  question: string,
  retrievedChunks: QdrantResult[] = [],
  options: GenerateOptions
): Promise<GenerationResult> {
  try {
    if (!question || typeof question !== "string") throw new Error("La pregunta debe ser un string no vacío");
    if (!Array.isArray(retrievedChunks)) throw new Error("Los chunks recuperados deben ser un array");

    const context  = buildContext(retrievedChunks);
    const messages = buildPrompt(question, context, options);

    const completion = await openai.chat.completions.create({
      model:    MODEL,
      messages: messages as Parameters<typeof openai.chat.completions.create>[0]["messages"],
      max_tokens: options.maxTokens ?? 4200,
      ...(options.openaiOptions ?? {}),
    });

    const choice  = completion.choices?.[0];
    const message = choice?.message ?? {};
    let   answer  = typeof message.content === "string" ? message.content.trim() : "";

    answer = normalizeAnswer(answer);

    if (!answer) throw new Error("No se recibió respuesta del modelo");

    return new GenerationResult(answer, true, retrievedChunks.length, {
      model:            MODEL,
      totalTokens:      completion.usage?.total_tokens,
      promptTokens:     completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      timestamp:        new Date().toISOString(),
    });

  } catch (error) {
    console.error("[RAG] Error en generateAnswer:", error);
    return new GenerationResult(
      "Lo siento, hubo un error al generar la respuesta.",
      false,
      retrievedChunks.length,
      { error: (error as Error).message, model: MODEL, timestamp: new Date().toISOString() }
    );
  }
}
