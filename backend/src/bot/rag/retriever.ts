/**
 * Retrieval con re-ranking BGE.
 */

import { getQdrantClient, getCollectionName, generateEmbedding } from "./client.js";
import { bgeRerank, type QdrantResult } from "./reranker.js";

const DEFAULT_K = 5;

// ---------------------------------------------------------------------------
// Búsqueda base
// ---------------------------------------------------------------------------

async function search(
  query: string,
  source: string | null,
  k = DEFAULT_K
): Promise<QdrantResult[]> {
  const client         = getQdrantClient();
  const collectionName = getCollectionName();
  const queryVector    = await generateEmbedding(query);

  const results = await client.search(collectionName, {
    vector: queryVector,
    limit:  k,
    filter: source
      ? { must: [{ key: "source", match: { value: source } }] }
      : undefined,
  });

  return results as unknown as QdrantResult[];
}

async function smartSearch(
  query: string,
  options: { source?: string | null; k?: number; useReranking?: boolean } = {}
): Promise<QdrantResult[]> {
  const { source = null, k = DEFAULT_K, useReranking = true } = options;
  const initialResults = await search(query, source, k);

  if (useReranking && initialResults.length > 1) {
    return bgeRerank(query, initialResults);
  }
  return initialResults;
}

// ---------------------------------------------------------------------------
// Reconstrucción de contexto
// ---------------------------------------------------------------------------

interface RebuiltContext {
  context: string;
  sources: Array<{ docId: string; chunkIndex: number; page: unknown; score: number; semanticSimilarity: number }>;
  chunks:  QdrantResult[];
}

async function rebuildContext(results: QdrantResult[]): Promise<RebuiltContext> {
  if (!results || results.length === 0) {
    return { context: "", sources: [], chunks: [] };
  }

  const seenChunks = new Set<string>();
  const allChunks:  QdrantResult[] = [];

  for (const result of results) {
    const { docId, chunkIndex } = (result.payload ?? {}) as Record<string, unknown>;
    const chunkKey = `${docId}-${chunkIndex}`;

    if (!seenChunks.has(chunkKey)) {
      seenChunks.add(chunkKey);
      allChunks.push({
        ...result.payload,
        score:             result.score ?? 0,
        semanticSimilarity: (result as unknown as { bgeScore?: number }).bgeScore ?? (result.payload as Record<string, unknown>).semanticSimilarity ?? 0,
      } as unknown as QdrantResult);
    }
  }

  allChunks.sort((a, b) => {
    const aScore = (a as unknown as Record<string, number>).semanticSimilarity ?? 0;
    const bScore = (b as unknown as Record<string, number>).semanticSimilarity ?? 0;
    if (Math.abs(bScore - aScore) > 0.1) return bScore - aScore;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  const context = allChunks.map((c) => (c as unknown as Record<string, string>).text ?? "").join("\n\n---\n\n");

  return {
    context,
    sources: allChunks.map((c) => {
      const p = c as unknown as Record<string, unknown>;
      return {
        docId:              String(p.docId ?? ""),
        chunkIndex:         Number(p.chunkIndex ?? 0),
        page:               p.pageStart,
        score:              (c.score as number) ?? 0,
        semanticSimilarity: (p.semanticSimilarity as number) ?? 0,
      };
    }),
    chunks: allChunks,
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface RetrievalResult {
  query:        string;
  source:       string;
  context:      string;
  sources:      RebuiltContext["sources"];
  chunks:       QdrantResult[];
  totalResults: number;
  metadata:     Record<string, unknown>;
}

export async function retrieveImproved(
  query: string,
  options: { source?: string | null; k?: number } = {}
): Promise<RetrievalResult> {
  const { source = null, k = DEFAULT_K } = options;

  if (!query) throw new Error("Query es requerido");

  const searchResults            = await smartSearch(query, { source, k, useReranking: true });
  const { context, sources, chunks } = await rebuildContext(searchResults);

  return {
    query,
    source:       source ?? "multi-source",
    context,
    sources,
    chunks,
    totalResults: searchResults.length,
    metadata: {
      searchStrategy: source ? "single-source" : "multi-source",
      rerankingUsed:  true,
      k,
      timestamp: new Date().toISOString(),
    },
  };
}

export const retrieve     = (query: string, source?: string | null) => retrieveImproved(query, { source });
export const searchOnly   = (query: string, source?: string | null, k = DEFAULT_K) =>
  smartSearch(query, { source, k, useReranking: false });
