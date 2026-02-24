import { pipeline, env } from '@huggingface/transformers'

env.allowLocalModels = false	
	env.useBrowserCache = false

let rerankerPipeline = null

const getReranker = async () => {
	if (!rerankerPipeline) {
		console.log('🔄 Cargando modelo BGE reranker (primera vez ~30s)...')
		rerankerPipeline = await pipeline(
			'text-classification',
			'Xenova/bge-reranker-base',
			{ dtype: 'fp32' }
		)
		console.log('✅ BGE reranker listo')
	}
	return rerankerPipeline
}

/**
 * Reranks chunks using BGE cross-encoder.
 * Cross-encoder: toma (query, documento) juntos → full attention → score real de relevancia.
 * Superior a la similitud coseno (bi-encoder) porque captura la relación semántica
 * entre la query y el documento, no solo la cercanía vectorial por separado.
 *
 * @param {string} query - La query de búsqueda
 * @param {Array} results - Resultados de Qdrant con .payload.text
 * @returns {Array} results ordenados por bgeScore DESC
 */
export const bgeRerank = async (query, results) => {
	if (!results || results.length === 0) return results

	const reranker = await getReranker()
	const pairInputs = results.map(r => ({
		text: query,
		text_pair: r.payload?.text || r.text || ''
	}))
	const scores = await reranker(pairInputs, { top_k: 1 })

	return results
		.map((r, i) => ({ ...r, bgeScore: scores[i]?.[0]?.score ?? 0 }))
		.sort((a, b) => b.bgeScore - a.bgeScore)
}
