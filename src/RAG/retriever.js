import { getQdrantClient, getCollectionName, generateEmbedding } from './client.js'
const DEFAULT_K = 5
const search = async (query, source, k = DEFAULT_K) => {
	const client = getQdrantClient()
	const collectionName = getCollectionName()
	const queryVector = await generateEmbedding(query)
	
	// Construir filtro dinámicamente
	const filter = source ? {
		must: [
			{
				key: 'source',
				match: { value: source },
			},
		],
	} : undefined
	
	console.log(`🔍 Searching in collection: ${collectionName}`)
	console.log(`🔍 Source: ${source}`)
	console.log(`🔍 Filter:`, JSON.stringify(filter, null, 2))
	console.log(`🔍 Query vector length: ${queryVector.length}`)
	
	const results = await client.search(collectionName, {
		vector: queryVector,
		limit: k,
		filter: filter,
	})
	
	return results
}
const rerankByScore = (results) => {
	return [...results].sort((a, b) => b.score - a.score)
}
const getNeighborChunks = async (docId, chunkIndex, source) => {
	const client = getQdrantClient()
	const collectionName = getCollectionName()
	const neighborIndices = [chunkIndex - 1, chunkIndex + 1].filter(i => i >= 0)
	if (neighborIndices.length === 0) return []
	const neighbors = await client.scroll(collectionName, {
		filter: {
			must: [
				{ key: 'docId', match: { value: docId } },
				{ key: 'source', match: { value: source } },
				{
					key: 'chunkIndex',
					match: { any: neighborIndices },
				},
			],
		},
		limit: 2,
		with_payload: true,
	})
	return neighbors.points
}
const rebuildContext = async (results, source) => {
	if (!results || results.length === 0) {
		return { context: '', sources: [] }
	}
	const seenChunks = new Set()
	const allChunks = []
	for (const result of results) {
		const { docId, chunkIndex } = result.payload
		const chunkKey = `${docId}-${chunkIndex}`
		if (!seenChunks.has(chunkKey)) {
			seenChunks.add(chunkKey)
			allChunks.push({
				...result.payload,
				score: result.score,
			})
			const neighbors = await getNeighborChunks(docId, chunkIndex, source)
			for (const neighbor of neighbors) {
				const neighborKey = `${neighbor.payload.docId}-${neighbor.payload.chunkIndex}`
				if (!seenChunks.has(neighborKey)) {
					seenChunks.add(neighborKey)
					allChunks.push({
						...neighbor.payload,
						score: result.score * 0.5,
					})
				}
			}
		}
	}
	allChunks.sort((a, b) => {
		if (a.docId !== b.docId) return a.docId.localeCompare(b.docId)
		return a.chunkIndex - b.chunkIndex
	})
	const context = allChunks.map(c => c.text).join('\n\n---\n\n')
	return {
		context,
		sources: allChunks.map(c => ({
			docId: c.docId,
			chunkIndex: c.chunkIndex,
			page: c.pageStart,
		})),
		chunks: allChunks,
	}
}
export const retrieve = async (query, source) => {
	if (!query || !source) {
		throw new Error('Query y source son requeridos')
	}
	const searchResults = await search(query, source)
	const rerankedResults = rerankByScore(searchResults)
	const { context, sources, chunks } = await rebuildContext(rerankedResults, source)
	return {
		query,
		source,
		context,
		sources,
		chunks,
		totalResults: searchResults.length,
	}
}
export const searchOnly = async (query, source, k = DEFAULT_K) => {
	const results = await search(query, source, k)
	return rerankByScore(results)
}