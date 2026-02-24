import OpenAI from 'openai'
import 'dotenv/config'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

const GENERATION_CONFIG = {
    model: 'gpt-5',
    maxTokens: 10000,
}

class GenerationResult {
    constructor(answer, success, usedContext, metadata = {}) {
        this.answer = answer
        this.success = success
        this.usedContext = usedContext
        this.metadata = {
            model: GENERATION_CONFIG.model,
            timestamp: new Date().toISOString(),
            ...metadata
        }
    }
}

/**
 * Función principal de generación para RAG.
 * Requiere que options.systemPrompt venga de la BD (RagPsychologicalConfig).
 *
 * @param {string} question - Pregunta / identificador del test
 * @param {Array} retrievedChunks - Chunks recuperados del RAG
 * @param {Object} options - Debe incluir systemPrompt y userPromptTemplate desde BD
 * @returns {Promise<GenerationResult>}
 */
export async function generateAnswer(question, retrievedChunks = [], options = {}) {
    try {
        if (!question || typeof question !== 'string') {
            throw new Error('La pregunta debe ser un string no vacío')
        }

        if (!Array.isArray(retrievedChunks)) {
            throw new Error('Los chunks recuperados deben ser un array')
        }

        const context = buildContext(retrievedChunks)
        const messages = buildPrompt(question, context, options)

        const completion = await openai.chat.completions.create({
            model: GENERATION_CONFIG.model,
            messages,
            max_completion_tokens: options.maxTokens ?? GENERATION_CONFIG.maxTokens,
            ...options.openaiOptions
        })

        const answer = completion.choices[0]?.message?.content?.trim()

        if (!answer) {
            throw new Error('No se recibió respuesta del modelo')
        }

        return new GenerationResult(
            answer,
            true,
            retrievedChunks.length,
            {
                totalTokens: completion.usage?.total_tokens,
                promptTokens: completion.usage?.prompt_tokens,
                completionTokens: completion.usage?.completion_tokens
            }
        )

    } catch (error) {
        console.error('Error en generateAnswer:', error)

        return new GenerationResult(
            'Lo siento, hubo un error al generar la respuesta.',
            false,
            retrievedChunks.length,
            { error: error.message }
        )
    }
}

/**
 * Construye el contexto a partir de los chunks recuperados.
 * Ordena por documento y posición para coherencia narrativa.
 */
function buildContext(chunks) {
    if (!chunks || chunks.length === 0) {
        return 'No se encontró contexto relevante.'
    }

    const chunkMeta = (chunk) => chunk.payload || chunk || {}

    const sortedChunks = [...chunks].sort((a, b) => {
        const aMeta = chunkMeta(a)
        const bMeta = chunkMeta(b)
        if (aMeta.docId !== bMeta.docId) {
            return (aMeta.docId || '').localeCompare(bMeta.docId || '')
        }
        return (aMeta.chunkIndex || 0) - (bMeta.chunkIndex || 0)
    })

    return sortedChunks.map((chunk, index) => {
        const metadata = chunkMeta(chunk)
        const docName = metadata.docName || 'Sin documento'
        const page = metadata.pageStart || '?'
        return `[Chunk ${index + 1} | ${docName} | Página ${page}]\n${chunk.text || metadata.text || ''}`
    }).join('\n\n---\n\n')
}

/**
 * Construye el array de mensajes para OpenAI.
 * El systemPrompt DEBE venir de la BD — si no llega, lanza error.
 */
function buildPrompt(question, context, options = {}) {
    if (!options.systemPrompt) {
        throw new Error('systemPrompt es requerido — debe provenir de la BD (RagPsychologicalConfig)')
    }

    const userPromptTemplate = options.userPromptTemplate || `Pregunta: {question}\n\nContexto:\n{context}`

    const userContent = userPromptTemplate
        .replace('{question}', question)
        .replace('{context}', context)

    return [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: userContent }
    ]
}

export function getGenerationConfig() {
    return { ...GENERATION_CONFIG }
}

export { GenerationResult }
