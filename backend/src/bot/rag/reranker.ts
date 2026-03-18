/**
 * BGE Reranker — cross-encoder para re-ordenar resultados de Qdrant.
 */

import { pipeline, env as hfEnv } from "@huggingface/transformers";

hfEnv.allowLocalModels = false;
hfEnv.useBrowserCache  = false;

type RerankerPipeline = Awaited<ReturnType<typeof pipeline>>;

let rerankerPipeline: RerankerPipeline | null = null;

async function getReranker(): Promise<RerankerPipeline> {
  if (!rerankerPipeline) {
    console.log("[RAG] Cargando modelo BGE reranker (primera vez ~30s)...");
    rerankerPipeline = await pipeline(
      "text-classification",
      "Xenova/bge-reranker-base",
      { dtype: "fp32" as never }
    );
    console.log("[RAG] BGE reranker listo");
  }
  return rerankerPipeline;
}

export interface QdrantResult {
  id:      string | number;
  score:   number;
  payload: Record<string, unknown>;
  bgeScore?: number;
  [key: string]: unknown;
}

/**
 * Re-ordena resultados de Qdrant usando BGE cross-encoder.
 * Superior a similitud coseno porque evalúa (query, documento) juntos.
 */
export async function bgeRerank(
  query: string,
  results: QdrantResult[]
): Promise<QdrantResult[]> {
  if (!results || results.length === 0) return results;

  const reranker = await getReranker();

  const pairInputs = results.map((r) => ({
    text:      query,
    text_pair: (r.payload?.text as string) ?? "",
  }));

  const scores = await (reranker as (input: unknown, opts: unknown) => Promise<Array<Array<{ score: number }>>>)(
    pairInputs,
    { top_k: 1 }
  );

  return results
    .map((r, i) => ({ ...r, bgeScore: scores[i]?.[0]?.score ?? 0 }))
    .sort((a, b) => (b.bgeScore ?? 0) - (a.bgeScore ?? 0));
}
