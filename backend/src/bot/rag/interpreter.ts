/**
 * Interpretador psicológico con RAG.
 */

import { generateAnswer }       from "./generator.js";
import { retrieveImproved }     from "./retriever.js";
import { getRagConfig, guardarResultadoPrueba } from "./config.js";
import type { QdrantResult }    from "./reranker.js";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const K_CANDIDATES = 10;
const K_PER_ASPECT  = 2;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export class PsychologicalInterpretationResult {
  constructor(
    public readonly interpretation: string,
    public readonly success:        boolean,
    public readonly metadata:       Record<string, unknown>
  ) {}
}

interface NormativeQuery { aspect: string; query: string }

interface RetrievalGroup {
  aspect:  string;
  chunks:  QdrantResult[];
  sources: unknown[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateNormativeQueries(testId: string): NormativeQuery[] {
  const upper = testId.toUpperCase();

  if (upper === "GHQ12") {
    return [
      { aspect: "reglas_puntuacion_en", query: "GHQ-12 scoring method GHQ Likert binary bimodal score calculation" },
      { aspect: "reglas_puntuacion_es", query: "GHQ-12 método de puntuación reglas Likert puntuación binaria cálculo" },
      { aspect: "puntos_corte_en",      query: "GHQ-12 cutoff threshold score sensitivity specificity screening classification" },
      { aspect: "puntos_corte_es",      query: "GHQ-12 punto de corte umbral sensibilidad especificidad tamizaje clasificación" },
      { aspect: "baremos_en",           query: "GHQ-12 normative data percentiles population reference scores ranges" },
      { aspect: "baremos_es",           query: "GHQ-12 baremos normativos percentiles datos poblacionales puntajes de referencia" },
      { aspect: "estructura_en",        query: "GHQ-12 factor structure subscales unidimensional validation psychometric" },
      { aspect: "estructura_es",        query: "GHQ-12 estructura factorial subescalas validación unidimensional psicométrico" },
    ];
  }

  if (upper === "DASS21") {
    return [
      { aspect: "reglas_puntuacion_en", query: "DASS-21 scoring subscale sum multiply depression anxiety stress calculation" },
      { aspect: "reglas_puntuacion_es", query: "DASS-21 puntuación subescala suma multiplicar depresión ansiedad estrés cálculo" },
      { aspect: "puntos_corte_en",      query: "DASS-21 cutoff severity levels normal mild moderate severe extremely severe" },
      { aspect: "puntos_corte_es",      query: "DASS-21 punto de corte niveles de severidad normal leve moderado severo extremadamente severo" },
      { aspect: "baremos_en",           query: "DASS-21 normative percentiles population reference ranges scores" },
      { aspect: "baremos_es",           query: "DASS-21 baremos normativos percentiles población rangos de referencia puntajes" },
      { aspect: "estructura_en",        query: "DASS-21 factor structure three subscales depression anxiety stress validation" },
      { aspect: "estructura_es",        query: "DASS-21 estructura factorial tres subescalas depresión ansiedad estrés validación" },
    ];
  }

  return [];
}

function selectTopKPerAspect(groups: RetrievalGroup[], topK = K_PER_ASPECT): QdrantResult[] {
  const aspectGroups: Record<string, QdrantResult[]> = {};

  for (const { aspect, chunks } of groups) {
    const base = aspect.replace(/_en$/, "").replace(/_es$/, "");
    if (!aspectGroups[base]) aspectGroups[base] = [];
    aspectGroups[base].push(...chunks);
  }

  const selected: QdrantResult[] = [];
  const seenHashes  = new Set<string>();

  for (const base of Object.keys(aspectGroups)) {
    const sorted = aspectGroups[base].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    let taken    = 0;

    for (const chunk of sorted) {
      if (taken >= topK) break;
      const hash = (chunk as unknown as Record<string, string>).textHash
        ?? (chunk.payload as Record<string, unknown>)?.textHash as string
        ?? (chunk as unknown as Record<string, string>).text;

      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        selected.push({ ...chunk, aspectSource: base } as unknown as QdrantResult);
        taken++;
      }
    }
  }

  return selected;
}

function buildItemScores(rawResults: Record<number, number[]>): Array<{ item: number; score: number }> {
  const items: Array<{ item: number; score: number }> = [];
  for (const score of [0, 1, 2, 3]) {
    const arr = Array.isArray(rawResults?.[score]) ? rawResults[score] : [];
    for (const item of arr) {
      const num = Number(item);
      if (Number.isFinite(num)) items.push({ item: num, score });
    }
  }
  return items.sort((a, b) => a.item - b.item);
}

function buildItemScoresCompact(rawResults: Record<number, number[]>): string {
  return buildItemScores(rawResults)
    .map(({ item, score }) => `${item}=${score}`)
    .join(", ");
}

function extractDocumentNames(chunks: QdrantResult[]): string[] {
  const names = new Set<string>();
  for (const chunk of chunks) {
    const docName = (chunk.payload as Record<string, string>)?.docName;
    if (docName) names.add(docName);
  }
  return Array.from(names);
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------

export async function interpretPsychologicalTest(
  testId:     string,
  rawResults: Record<number, number[]>,
  patientId:  string
): Promise<PsychologicalInterpretationResult> {
  try {
    if (!testId || !rawResults || !patientId) {
      throw new Error("Parámetros requeridos: testId, rawResults, patientId");
    }
    if (!["ghq12", "dass21"].includes(testId.toLowerCase())) {
      throw new Error(`Test no soportado: ${testId}. Tests soportados: ghq12, dass21`);
    }

    console.log(`[RAG] Iniciando interpretación ${testId} — paciente: ${patientId}`);
    const config  = await getRagConfig();
    const source  = testId.toLowerCase() === "ghq12" ? "GHQ-12" : "DASS-21";
    const queries = generateNormativeQueries(testId);

    console.log(`[RAG] Ejecutando ${queries.length} queries bilingües para ${testId}...`);
    const allRetrievalResults: RetrievalGroup[] = [];

    for (const q of queries) {
      const result = await retrieveImproved(q.query, { k: K_CANDIDATES, source });
      if (result.chunks && result.chunks.length > 0) {
        allRetrievalResults.push({ aspect: q.aspect, chunks: result.chunks, sources: result.sources });
      }
    }

    const uniqueChunks = selectTopKPerAspect(allRetrievalResults);
    console.log(`[RAG] Chunks únicos seleccionados: ${uniqueChunks.length}`);

    if (uniqueChunks.length === 0) {
      throw new Error(`No se encontraron documentos relevantes para ${testId}`);
    }

    const enhancedChunks = [
      {
        text:    `Datos del paciente: ${JSON.stringify(rawResults)}`,
        payload: { docName: "Datos_Paciente", chunkIndex: 0, paciente_id: patientId },
      } as unknown as QdrantResult,
      ...uniqueChunks,
    ];

    const testLabel   = testId.toUpperCase().replace("GHQ12", "GHQ-12").replace("DASS21", "DASS-21");
    const itemScores  = buildItemScores(rawResults);
    const patientData = { paciente_id: patientId, test_id: testId, total_items_respondidos: itemScores.length };

    console.log("[RAG] Generando interpretación con OpenAI...");
    const generationResult = await generateAnswer(testLabel, enhancedChunks, {
      systemPrompt:     config.systemInstructions,
      userPromptTemplate: config.promptTemplate,
      patientData,
      rawResults,
      itemScores,
      maxTokens: 4200,
    });

    if (!generationResult.success) throw new Error("Error en generación de interpretación");

    // Guardar en BD
    const compact = buildItemScoresCompact(rawResults);
    await guardarResultadoPrueba(
      patientId,
      `interpretacion_${testId}`,
      [`test=${testId}`, `fecha=${new Date().toISOString()}`, `items=${compact}`].join("\n")
    );

    const metadata = {
      paciente_id:          patientId,
      test_id:              testId,
      prompt_version:       config.version,
      documentos_consultados: extractDocumentNames(uniqueChunks),
      chunks_utilizados:    uniqueChunks.length,
      modelo_usado:         generationResult.metadata?.model,
      tokens_usados:        generationResult.metadata?.totalTokens,
      estrategia_retrieval: "multi-query-bilingual",
    };

    console.log(`[RAG] Interpretación completada — docs: ${(metadata.documentos_consultados as string[]).join(", ")}`);
    return new PsychologicalInterpretationResult(generationResult.answer, true, metadata);

  } catch (error) {
    console.error(`[RAG] Error en interpretación ${testId}:`, error);
    return new PsychologicalInterpretationResult(
      "Lo siento, hubo un error al interpretar los resultados.",
      false,
      { paciente_id: patientId, test_id: testId, error: (error as Error).message, timestamp: new Date().toISOString() }
    );
  }
}
