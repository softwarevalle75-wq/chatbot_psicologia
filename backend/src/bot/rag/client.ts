/**
 * RAG Client — conexión con Qdrant y generación de embeddings.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { openai } from "../../lib/openai.js";
import { env, requireQdrant } from "../../config/env.js";

// ---------------------------------------------------------------------------
// Singleton de Qdrant (lazy — solo se crea cuando se usa)
// ---------------------------------------------------------------------------

let _qdrantClient: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!_qdrantClient) {
    requireQdrant();
    _qdrantClient = new QdrantClient({
      url:    env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY || undefined,
    });
  }
  return _qdrantClient;
}

export const getCollectionName = (): string => env.QDRANT_COLLECTION;

// ---------------------------------------------------------------------------
// Gestión de colección
// ---------------------------------------------------------------------------

export async function ensureCollection(): Promise<string> {
  const client         = getQdrantClient();
  const collectionName = getCollectionName();

  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === collectionName);

  if (!exists) {
    await client.createCollection(collectionName, {
      vectors: { size: env.EMBEDDING_DIMENSIONS, distance: "Cosine" },
    });
    console.log(`[RAG] Colección '${collectionName}' creada`);
  }

  // Crear índice de payload para filtrado por source
  try {
    await client.createPayloadIndex(collectionName, {
      field_name:   "source",
      field_schema: "keyword",
    });
  } catch (error) {
    const msg = String((error as Error)?.message ?? error ?? "");
    if (!msg.toLowerCase().includes("already exists")) {
      console.warn(`[RAG] No se pudo crear índice de 'source': ${msg}`);
    }
  }

  return collectionName;
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model:      env.EMBEDDING_MODEL,
    input:      text,
    dimensions: env.EMBEDDING_DIMENSIONS,
  });
  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model:      env.EMBEDDING_MODEL,
    input:      texts,
    dimensions: env.EMBEDDING_DIMENSIONS,
  });
  return response.data.map((item) => item.embedding);
}
