import { QdrantClient } from '@qdrant/js-client-rest'
import OpenAI from 'openai'
import 'dotenv/config'
const qdrantClient = new QdrantClient({
	url: process.env.QDRANT_URL,
	apiKey: process.env.QDRANT_API_KEY,
})
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
})
const COLLECTION_NAME = process.env.QDRANT_COLECTION || 'rag-psicologia'
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large'
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536
export const getCollectionName = () => COLLECTION_NAME
export const getQdrantClient = () => qdrantClient
export const ensureCollection = async () => {
	const collections = await qdrantClient.getCollections()
	const exists = collections.collections.some(c => c.name === COLLECTION_NAME)
	if (!exists) {
		await qdrantClient.createCollection(COLLECTION_NAME, {
			vectors: {
				size: EMBEDDING_DIMENSIONS,
				distance: 'Cosine',
			},
		})
		console.log(`✅ Colección '${COLLECTION_NAME}' creada`)
	}
	return COLLECTION_NAME
}
export const generateEmbedding = async (text) => {
	const response = await openai.embeddings.create({
		model: EMBEDDING_MODEL,
		input: text,
		dimensions: EMBEDDING_DIMENSIONS,
	})
	return response.data[0].embedding
}
export const generateEmbeddings = async (texts) => {
	const response = await openai.embeddings.create({
		model: EMBEDDING_MODEL,
		input: texts,
		dimensions: EMBEDDING_DIMENSIONS,
	})
	return response.data.map(item => item.embedding)
}