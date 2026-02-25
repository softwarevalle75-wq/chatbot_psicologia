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
 * Funcion principal de generacion para RAG.
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
            throw new Error('La pregunta debe ser un string no vacio')
        }

        if (!Array.isArray(retrievedChunks)) {
            throw new Error('Los chunks recuperados deben ser un array')
        }

        const context = buildContext(retrievedChunks)
        const messages = buildPrompt(question, context, options)

        const completion = await openai.chat.completions.create({
            model: GENERATION_CONFIG.model,
            messages,
            reasoning_effort: options.reasoningEffort ?? 'low',
            max_completion_tokens: options.maxTokens ?? GENERATION_CONFIG.maxTokens,
            ...options.openaiOptions
        })

        const choice = completion.choices?.[0]
        const message = choice?.message || {}

        let answer = ''
        if (typeof message.content === 'string') {
            answer = message.content.trim()
        } else if (Array.isArray(message.content)) {
            answer = message.content
                .map(part => {
                    if (typeof part === 'string') return part
                    if (typeof part?.text === 'string') return part.text
                    if (typeof part?.text?.value === 'string') return part.text.value
                    if (typeof part?.content === 'string') return part.content
                    return ''
                })
                .join('')
                .trim()
        }

        if (!answer && typeof message.refusal === 'string') {
            answer = message.refusal.trim()
        }

        if (!answer) {
            const preview = JSON.stringify({ finish_reason: choice?.finish_reason, message }, null, 2)
            console.error('Respuesta vacia de OpenAI:', preview)
            throw new Error('No se recibio respuesta del modelo')
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
 * Ordena por documento y posicion para coherencia narrativa.
 */
function buildContext(chunks) {
    if (!chunks || chunks.length === 0) {
        return 'No se encontro contexto relevante.'
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
        return `[Chunk ${index + 1} | ${docName} | Pagina ${page}]\n${chunk.text || metadata.text || ''}`
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

    const userPromptTemplate = options.userPromptTemplate || [
        'Instrumento: {question}',
        '',
        'Datos del paciente:',
        '{patientData}',
        '',
        'Resultados del paciente:',
        '{rawResults}',
        '',
        'Puntaje por item:',
        '{itemScores}',
        '',
        'Contexto normativo recuperado:',
        '{context}'
    ].join('\n')

    const replacements = {
        question,
        context,
        rawResults: formatRawResults(options.rawResults),
        patientData: formatPatientData(options.patientData),
        itemScores: formatItemScores(options.itemScores)
    }

    let userContent = userPromptTemplate
    for (const [key, value] of Object.entries(replacements)) {
        userContent = userContent.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }

    const hasContextSlot = /\{context\}/.test(userPromptTemplate)
    const hasRawResultsSlot = /\{rawResults\}/.test(userPromptTemplate)
    const hasPatientDataSlot = /\{patientData\}/.test(userPromptTemplate)
    const hasItemScoresSlot = /\{itemScores\}/.test(userPromptTemplate)

    if (!hasContextSlot) {
        userContent += `\n\nContexto normativo recuperado:\n${context}`
    }
    if (!hasRawResultsSlot) {
        userContent += `\n\nResultados del paciente:\n${replacements.rawResults}`
    }
    if (!hasPatientDataSlot) {
        userContent += `\n\nDatos del paciente:\n${replacements.patientData}`
    }
    if (!hasItemScoresSlot) {
        userContent += `\n\nPuntaje por item:\n${replacements.itemScores}`
    }

    if (!hasContextSlot && userPromptTemplate.length > 3000) {
        userContent = [
            `Instrumento: ${question}`,
            '',
            'Datos del paciente:',
            replacements.patientData,
            '',
            'Resultados del paciente:',
            replacements.rawResults,
            '',
            'Puntaje por item:',
            replacements.itemScores,
            '',
            'Contexto normativo recuperado:',
            context,
            '',
            'Genera un informe tecnico en Markdown con identificacion, resultados, clasificacion normativa, comparacion con puntos de corte, perfil probable, hipotesis tentativa, recomendaciones, limitaciones y advertencia etica.'
        ].join('\n')
    }

    userContent += [
        '',
        'Instrucciones obligatorias de seguridad clinica (cumplimiento estricto):',
        '- No inventes informacion ni uses conocimiento fuera del contexto normativo recuperado.',
        '- Cuando los puntajes superen ampliamente los puntos de corte clinicos o indiquen riesgo elevado, recomienda explicitamente remision a una IPS para valoracion clinica presencial, con formulacion prudente y sin diagnostico definitivo.',
        '- Si hay elevaciones clinicamente relevantes en items vinculados con depresion, ansiedad o tension, recomienda explicitamente aplicar DASS-21 como complemento dimensional.'
    ].join('\n')

    return [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: userContent }
    ]
}

function formatPatientData(patientData) {
    if (!patientData || typeof patientData !== 'object') {
        return 'No disponible.'
    }
    const lines = []
    Object.entries(patientData).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return
        lines.push(`- ${key}: ${value}`)
    })
    return lines.length > 0 ? lines.join('\n') : 'No disponible.'
}

function formatRawResults(rawResults) {
    if (!rawResults || typeof rawResults !== 'object') {
        return 'No se recibieron resultados estructurados.'
    }

    const score0 = Array.isArray(rawResults[0]) ? rawResults[0] : []
    const score1 = Array.isArray(rawResults[1]) ? rawResults[1] : []
    const score2 = Array.isArray(rawResults[2]) ? rawResults[2] : []
    const score3 = Array.isArray(rawResults[3]) ? rawResults[3] : []

    return [
        `- Puntaje 0: [${score0.join(', ')}]`,
        `- Puntaje 1: [${score1.join(', ')}]`,
        `- Puntaje 2: [${score2.join(', ')}]`,
        `- Puntaje 3: [${score3.join(', ')}]`,
        `- JSON crudo: ${JSON.stringify(rawResults)}`
    ].join('\n')
}

function formatItemScores(itemScores) {
    if (!Array.isArray(itemScores) || itemScores.length === 0) {
        return 'No se pudo reconstruir puntaje por item.'
    }

    return itemScores
        .map(({ item, score }) => `- Item ${item}: ${score}`)
        .join('\n')
}

export function getGenerationConfig() {
    return { ...GENERATION_CONFIG }
}

export { GenerationResult }
