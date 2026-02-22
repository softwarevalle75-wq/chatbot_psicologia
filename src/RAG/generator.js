import OpenAI from 'openai'
import 'dotenv/config'

/**
 * Configuración del cliente OpenAI para generación
 * Principio: Single Responsibility - separar configuración de lógica
 */
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Constantes de configuración para generación
 * Principio: DRY - evitar valores mágicos en el código
 */
const GENERATION_CONFIG = {
    model: 'gpt-3.5-turbo-16k', // ← Probar con este modelo
    temperature: 0.3,
    maxTokens: 500,
    systemPrompt: `Eres un asistente especializado en psicología que responde preguntas 
basándose únicamente en el contexto proporcionado.

Reglas estrictas:
1. Responde SOLO usando la información del contexto
2. Si la información no está en el contexto, responde exactamente: 
   "La información no se encuentra en el contexto proporcionado."
3. Sé conciso y preciso
4. No inventes ni asumas información fuera del contexto`
}

/**
 * Interfaz para el resultado de generación
 * Principio: Tipado fuerte para mejor mantenibilidad
 */
class GenerationResult {
    constructor(answer, success, usedContext, metadata = {}) {
        this.answer = answer
        this.success = success
        this.usedContext = usedContext
        this.metadata = {
            model: GENERATION_CONFIG.model,
            temperature: GENERATION_CONFIG.temperature,
            timestamp: new Date().toISOString(),
            ...metadata
        }
    }
}

/**
 * Función principal de generación para RAG
 * Principio: Single Responsibility - solo se encarga de generar respuestas
 * 
 * @param {string} question - Pregunta del usuario
 * @param {Array} retrievedChunks - Chunks recuperados del RAG
 * @param {Object} options - Opciones adicionales de configuración
 * @returns {Promise<GenerationResult>} Resultado de la generación
 */
export async function generateAnswer(question, retrievedChunks = [], options = {}) {
    try {
        // Validación de inputs (Principio: Fail Fast)
        if (!question || typeof question !== 'string') {
            throw new Error('La pregunta debe ser un string no vacío')
        }

        if (!Array.isArray(retrievedChunks)) {
            throw new Error('Los chunks recuperados deben ser un array')
        }

        // Construcción del contexto (Principio: Separation of Concerns)
        const context = buildContext(retrievedChunks)
        
        // Construcción del prompt (Principio: Dependency Injection)
        const messages = buildPrompt(question, context, options.customPrompt)

        // Llamada a OpenAI con configuración específica
        const completion = await openai.chat.completions.create({
            model: GENERATION_CONFIG.model,
            messages,
            temperature: GENERATION_CONFIG.temperature,
            max_tokens: GENERATION_CONFIG.maxTokens,
            ...options.openaiOptions // Permitir override si es necesario
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
 * Construye el contexto a partir de los chunks recuperados
 * Principio: Pure Function - sin side effects
 * 
 * @param {Array} chunks - Array de chunks con payload
 * @returns {string} Contexto formateado
 */
function buildContext(chunks) {
    if (!chunks || chunks.length === 0) {
        return 'No se encontró contexto relevante.'
    }

    // Ordenar chunks por documento y chunkIndex para mantener coherencia
    const sortedChunks = [...chunks].sort((a, b) => {
        if (a.payload?.docId !== b.payload?.docId) {
            return a.payload.docId.localeCompare(b.payload.docId)
        }
        return (a.payload?.chunkIndex || 0) - (b.payload?.chunkIndex || 0)
    })

    // Construir contexto con metadatos para trazabilidad
    return sortedChunks.map((chunk, index) => {
        const metadata = chunk.payload || {}
        return `[Chunk ${index + 1} | ${metadata.docName} | Página ${metadata.pageStart}]\n${chunk.text || chunk.payload?.text || ''}`
    }).join('\n\n---\n\n')
}

/**
 * Construye el array de mensajes para OpenAI
 * Principio: Builder Pattern - construcción flexible de prompts
 * 
 * @param {string} question - Pregunta del usuario
 * @param {string} context - Contexto construido
 * @param {string} customPrompt - Prompt personalizado opcional
 * @returns {Array} Array de mensajes para OpenAI
 */
function buildPrompt(question, context, customPrompt = null) {
    const systemPrompt = customPrompt || GENERATION_CONFIG.systemPrompt
    
    return [
        {
            role: 'system',
            content: systemPrompt
        },
        {
            role: 'user',
            content: `Pregunta: ${question}\n\nContexto:\n${context}`
        }
    ]
}

/**
 * Función utilitaria para testing - permite sobreescribir configuración
 * Principio: Open/Closed Principle - extensibilidad sin modificación
 */
export function setGenerationConfig(newConfig) {
    Object.assign(GENERATION_CONFIG, newConfig)
}

/**
 * Función utilitaria para obtener configuración actual
 * Principio: Encapsulation - control de acceso al estado interno
 */
export function getGenerationConfig() {
    return { ...GENERATION_CONFIG }
}

// Exportar la clase para testing y extensibilidad
export { GenerationResult }
