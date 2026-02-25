import { getQdrantClient, getCollectionName, generateEmbedding } from './client.js'
import { bgeRerank } from './reranker.js'

/**
 * Sistema de retrieval mejorado con re-ranking real
 * Principio: Strategy Pattern - diferentes estrategias de búsqueda y ranking
 */

const DEFAULT_K = 5

/**
 * Búsqueda básica con vector similarity
 * Principio: Single Responsibility - solo búsqueda
 */
const search = async (query, source, k = DEFAULT_K) => {
    const client = getQdrantClient()
    const collectionName = getCollectionName()
    const queryVector = await generateEmbedding(query)

    const results = await client.search(collectionName, {
        vector: queryVector,
        limit: k,
        filter: source ? {
            must: [
                {
                    key: 'source',
                    match: { value: source },
                },
            ],
        } : undefined, // ← Si no hay source, buscar en TODOS
    })
    
    return results
}

/**
 * Búsqueda inteligente con detección automática de source
 * Principio: Factory Pattern - crear búsqueda según parámetros
 */
const smartSearch = async (query, options = {}) => {
    const { source = null, k = DEFAULT_K, useReranking = true } = options
    
    // 1. Búsqueda inicial
    const initialResults = await search(query, source, k)
    
    // 2. Re-ranking si se solicita
    if (useReranking && initialResults.length > 1) {
        const rerankedResults = await bgeRerank(query, initialResults)
        return rerankedResults
    }
    
    return initialResults
}

/**
 * Reconstrucción de contexto mejorada
 * Principio: Builder Pattern - construir contexto paso a paso
 */
const rebuildContext = async (results) => {
    if (!results || results.length === 0) {
        return { context: '', sources: [], chunks: [] }
    }
    
    const seenChunks = new Set()
    const allChunks = []
    
    for (const result of results) {
        const { docId, chunkIndex } = result.payload || result
        const chunkKey = `${docId}-${chunkIndex}`
        
        if (!seenChunks.has(chunkKey)) {
            seenChunks.add(chunkKey)
            allChunks.push({
                ...result.payload,
                score: result.score || 0,
                semanticSimilarity: result.bgeScore || result.semanticSimilarity || 0
            })
            
            // Opcional: agregar chunks vecinos (desactivado por ahora)
            // const neighbors = await getNeighborChunks(docId, chunkIndex, source)
            // ... procesar vecinos
        }
    }
    
    // Ordenar por relevancia combinada
    allChunks.sort((a, b) => {
        // Prioridad 1: Similitud semántica
        if (Math.abs(b.semanticSimilarity - a.semanticSimilarity) > 0.1) {
            return b.semanticSimilarity - a.semanticSimilarity
        }
        
        // Prioridad 2: Score original
        return b.score - a.score
    })
    
    const context = allChunks.map(c => c.text).join('\n\n---\n\n')
    
    return {
        context,
        sources: allChunks.map(c => ({
            docId: c.docId,
            chunkIndex: c.chunkIndex,
            page: c.pageStart,
            score: c.score,
            semanticSimilarity: c.semanticSimilarity
        })),
        chunks: allChunks,
    }
}

/**
 * Función principal de retrieval mejorada
 * Principio: Facade Pattern - interfaz unificada
 */
export const retrieveImproved = async (query, options = {}) => {
    const { source = null, k = DEFAULT_K } = options
    
    if (!query) {
        throw new Error('Query es requerido')
    }
    
    try {
        // Búsqueda inteligente con re-ranking
        const searchResults = await smartSearch(query, { source, k, useReranking: true })
        
        // Reconstrucción de contexto
        const { context, sources, chunks } = await rebuildContext(searchResults)
        
        return {
            query,
            source: source || 'multi-source',
            context,
            sources,
            chunks,
            totalResults: searchResults.length,
            metadata: {
                searchStrategy: source ? 'single-source' : 'multi-source',
                rerankingUsed: true,
                k,
                timestamp: new Date().toISOString()
            }
        }
        
    } catch (error) {
        console.error('Error en retrieveImproved:', error.message)
        throw error
    }
}

/**
 * Función legacy para compatibilidad
 * Principio: Adapter Pattern - mantener compatibilidad con código existente
 */
export const searchOnly = async (query, source, k = DEFAULT_K) => {
    return await smartSearch(query, { source, k, useReranking: false })
}

export const retrieve = async (query, source) => {
    return await retrieveImproved(query, { source })
}

// Exportar estrategias para testing
export { search, smartSearch }
