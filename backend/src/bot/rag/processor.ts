/**
 * Procesador de PDFs e indexación en Qdrant.
 */

import fs   from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { PdfReader } from "pdfreader";
import { getQdrantClient, getCollectionName, ensureCollection, generateEmbeddings } from "./client.js";
import { getEnabledSources, type SourceConfig } from "./sources.js";

const require  = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

// ---------------------------------------------------------------------------
// Constantes de chunking
// ---------------------------------------------------------------------------

const CHUNK_SIZE          = 1000;
const CHUNK_OVERLAP       = 100;
const NORMATIVE_CHUNK_SIZE = 700;
let   GLOBAL_CHUNK_ID     = 0;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface ChunkPayload {
  docId:      string;
  docName:    string;
  source:     string;
  version:    string;
  chunkIndex: number;
  pageStart:  number;
  pageEnd:    number;
  text:       string;
  textHash:   string;
  updatedAt:  string;
}

interface Chunk {
  id:      number;
  vector:  null;
  payload: ChunkPayload;
}

interface DocMetadata {
  docId:     string;
  docName:   string;
  source:    string;
  version:   string;
  pageStart: number;
  pageEnd:   number;
}

// ---------------------------------------------------------------------------
// Helpers de chunking
// ---------------------------------------------------------------------------

function createHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function isNormativeContent(text: string): boolean {
  const patterns = [
    "tabla","table","punto de corte","cut-off","baremo","norma",
    "coeficiente alfa","alpha","confiabilidad","sensibilidad",
    "especificidad","factor","carga factorial","percentil",
    "media","desviación","correlación","r=","p=","n=","item","subescala",
  ];
  const lower = text.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function findBestBreakPoint(text: string, maxLength: number): number {
  if (text.length <= maxLength) return text.length;

  for (const m of [...text.matchAll(/\n\n/g)]) {
    const next = m.index! + 2;
    if (next <= maxLength) return next;
  }
  for (const m of [...text.matchAll(/\n/g)].reverse()) {
    if (m.index! < maxLength - 1) return m.index! + 1;
  }
  for (const m of [...text.matchAll(/\./g)].reverse()) {
    if (m.index! < maxLength - 2) {
      const after = text.substring(m.index! + 1).trim();
      if (after.length > 0 && after[0] === after[0].toUpperCase()) return m.index! + 1;
    }
  }
  for (const m of [...text.matchAll(/ /g)].reverse()) {
    if (m.index! < maxLength - 1) return m.index!;
  }
  return maxLength;
}

function createOverlap(text: string, overlapLength: number): string {
  if (text.length <= overlapLength) return text;
  const start      = text.length - overlapLength;
  const firstSpace = text.indexOf(" ", start);
  return firstSpace !== -1 && firstSpace < text.length
    ? text.substring(firstSpace + 1)
    : text.substring(start);
}

function chunkSection(text: string, meta: DocMetadata, startIdx: number, startGlobalId: number): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkIndex      = startIdx;
  let globalCounter   = startGlobalId;
  let remainingText   = text.trim();
  let lastOverlap     = "";

  while (remainingText.length > 0) {
    let chunkText = "";
    const size    = isNormativeContent(remainingText.substring(0, 200)) ? NORMATIVE_CHUNK_SIZE : CHUNK_SIZE;

    if (lastOverlap) {
      const available = size - lastOverlap.length;
      if (available > 50) {
        const bp  = findBestBreakPoint(remainingText, available);
        chunkText = lastOverlap + remainingText.substring(0, bp).trim();
        remainingText = remainingText.substring(bp).trim();
      } else {
        chunkText = lastOverlap;
      }
      lastOverlap = "";
    } else {
      const bp  = findBestBreakPoint(remainingText, size);
      chunkText = remainingText.substring(0, bp).trim();
      remainingText = remainingText.substring(bp).trim();
    }

    if (remainingText.length > 0) lastOverlap = createOverlap(chunkText, CHUNK_OVERLAP);

    if (chunkText.length > 10) {
      chunks.push({
        id:     globalCounter++,
        vector: null,
        payload: {
          docId:      meta.docId,
          docName:    meta.docName,
          source:     meta.source,
          version:    meta.version,
          chunkIndex: chunkIndex++,
          pageStart:  meta.pageStart,
          pageEnd:    meta.pageEnd,
          text:       chunkText,
          textHash:   createHash(chunkText),
          updatedAt:  new Date().toISOString(),
        },
      });
    }
  }
  return chunks;
}

function chunkText(text: string, meta: DocMetadata): Chunk[] {
  const sections = text.split("\n\n---\n\n").filter((s) => s.trim().length > 0);
  let chunkIndex = 0;
  let globalId   = GLOBAL_CHUNK_ID;
  const all: Chunk[] = [];

  for (const section of sections) {
    const sec = chunkSection(section.trim(), meta, chunkIndex, globalId);
    all.push(...sec);
    chunkIndex += sec.length;
    globalId   += sec.length;
  }

  GLOBAL_CHUNK_ID = globalId;
  return all;
}

// ---------------------------------------------------------------------------
// Parseo de PDFs
// ---------------------------------------------------------------------------

async function parsePDF(filePath: string): Promise<{ text: string; numPages: number }> {
  const dataBuffer = fs.readFileSync(filePath);
  const textData   = await pdfParse(dataBuffer);

  const cleanedText = textData.text
    .split("\n")
    .filter((line) => !line.includes("|"))
    .join("\n");

  // Extraer tablas con pdfreader
  const rows: Record<string, string[]> = {};
  await new Promise<void>((resolve, reject) => {
    new PdfReader().parseBuffer(dataBuffer, (err: unknown, item: unknown) => {
      if (err) { reject(err); return; }
      if (!item) { resolve(); return; }
      const typedItem = item as { text?: string; y?: number };
      if (typedItem.text) {
        const y = typedItem.y !== undefined ? typedItem.y.toFixed(2) : "0";
        if (!rows[y]) rows[y] = [];
        rows[y].push(typedItem.text);
      }
    });
  });

  const sortedRows = Object.keys(rows)
    .sort((a, b) => parseFloat(a) - parseFloat(b))
    .map((y) => rows[y]);

  let tablesText = "";
  let currentTable: string[][] = [];
  let lastY: number | null = null;

  for (const row of sortedRows) {
    const yKey = Object.keys(rows).find((k) => rows[k] === row);
    const y    = parseFloat(yKey ?? "0");

    if (lastY !== null && Math.abs(y - lastY) > 5 && currentTable.length > 0) {
      if (currentTable.length >= 2) {
        const tableText = currentTable.map((r) => r.join(" | ")).join("\n");
        tablesText += "\n" + tableText + "\n";
      }
      currentTable = [];
    }
    currentTable.push(row);
    lastY = y;
  }

  if (currentTable.length >= 2) {
    tablesText += "\n" + currentTable.map((r) => r.join(" | ")).join("\n") + "\n";
  }

  return {
    text:     cleanedText + (tablesText ? "\n\n---\n\n" + tablesText : ""),
    numPages: textData.numpages,
  };
}

// ---------------------------------------------------------------------------
// Indexación
// ---------------------------------------------------------------------------

async function indexDocument(sourceConfig: SourceConfig): Promise<{ success: boolean; error?: string; chunksIndexed?: number }> {
  const client         = getQdrantClient();
  const collectionName = getCollectionName();

  console.log(`[RAG] Procesando: ${sourceConfig.name}`);

  if (!fs.existsSync(sourceConfig.manualPath)) {
    console.warn(`[RAG] Archivo no encontrado: ${sourceConfig.manualPath}`);
    return { success: false, error: "File not found" };
  }

  const { text, numPages } = await parsePDF(sourceConfig.manualPath);
  const chunks = chunkText(text, {
    docId:    sourceConfig.docId,
    docName:  sourceConfig.docName,
    source:   sourceConfig.source,
    version:  sourceConfig.version,
    pageStart: 1,
    pageEnd:   numPages,
  });

  const texts      = chunks.map((c) => c.payload.text);
  const embeddings = await generateEmbeddings(texts);
  const points     = chunks.map((chunk, i) => ({
    id:      chunk.id,
    vector:  embeddings[i],
    payload: chunk.payload,
  }));

  await client.upsert(collectionName, { wait: true, points });
  console.log(`[RAG] Indexados ${chunks.length} chunks para ${sourceConfig.name}`);
  return { success: true, chunksIndexed: chunks.length };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export async function initializeRAG(): Promise<Array<{ source: string; success: boolean; chunksIndexed?: number }>> {
  await ensureCollection();

  const client         = getQdrantClient();
  const collectionName = getCollectionName();

  try {
    const countResult    = await client.count(collectionName, { exact: true });
    const existingPoints = (countResult as unknown as { count?: number })?.count ?? 0;

    if (existingPoints > 0) {
      console.log(`[RAG] Ya indexado (${existingPoints} chunks). Omitiendo reindex al iniciar.`);
      return [];
    }
  } catch {
    console.warn("[RAG] No se pudo consultar el conteo de chunks. Se intentará indexar.");
  }

  const sources = getEnabledSources();
  console.log(`[RAG] Inicializando con ${sources.length} fuentes...`);
  const results = [];

  for (const source of sources) {
    const result = await indexDocument(source);
    results.push({ source: source.name, ...result });
  }

  console.log("[RAG] Inicialización completada");
  return results;
}

export async function reindexAll(): Promise<Array<{ source: string; success: boolean; chunksIndexed?: number }>> {
  const client         = getQdrantClient();
  const collectionName = getCollectionName();

  try {
    await client.deleteCollection(collectionName);
    console.log(`[RAG] Colección '${collectionName}' eliminada`);
  } catch { /* no existía */ }

  return initializeRAG();
}
