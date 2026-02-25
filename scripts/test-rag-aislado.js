// Test end-to-end del RAG — flujo completo: 8 queries bilingues + generacion GPT
// Sin dependencias de WhatsApp ni app.js
import { interpretPsychologicalTest } from '../src/RAG/psychological-interpreter.js'
import { getRagPsychologicalConfig } from '../src/RAG/rag-config.js'

const TEST_ID = 'ghq12'
const PATIENT_ID = process.env.TEST_PATIENT_ID || 'test-local'

// Perfil realista: distress moderado-alto (puntaje GHQ bimodal = 7/12)
// Items con respuesta 2 (Menos que habitual) o 3 (Mucho menos que habitual) = positivo en GHQ
const rawResults = {
    0: [1, 3, 5],
    1: [2, 4],
    2: [7, 9, 11, 12],
    3: [6, 8, 10]
}

function validateRawResults(results) {
    const groups = [0, 1, 2, 3]
    for (const key of groups) {
        if (!Array.isArray(results[key])) {
            throw new Error(`rawResults[${key}] debe ser un array`)
        }
    }
    const total = groups.reduce((acc, key) => acc + results[key].length, 0)
    if (total === 0) {
        throw new Error('rawResults esta vacio: no hay respuestas para interpretar')
    }
    return total
}

console.log('══════════════════════════════════════════════════════════')
console.log('🧪 TEST RAG AISLADO — GHQ-12 perfil distress moderado')
console.log('══════════════════════════════════════════════════════════')
console.log('📊 Perfil del paciente:')
console.log(`   Mejor que habitual:      items [${rawResults[0].join(',')}]`)
console.log(`   Igual que habitual:       items [${rawResults[1].join(',')}]`)
console.log(`   Menos que habitual:       items [${rawResults[2].join(',')}]`)
console.log(`   Mucho menos que habitual: items [${rawResults[3].join(',')}]`)
console.log('   → Puntaje GHQ bimodal: 7/12 — CASO PROBABLE')
console.log()

try {
    const totalItems = validateRawResults(rawResults)
    const config = await getRagPsychologicalConfig()
    const hasContextPlaceholder = /\{context\}/.test(config.promptTemplate || '')
    const hasQuestionPlaceholder = /\{question\}/.test(config.promptTemplate || '')

    console.log('🧩 Config de prompt (BD):')
    console.log(`   version:             ${config.version}`)
    console.log(`   tiene {question}:    ${hasQuestionPlaceholder ? 'si' : 'no'}`)
    console.log(`   tiene {context}:     ${hasContextPlaceholder ? 'si' : 'no'}`)
    console.log(`   system chars:        ${(config.systemInstructions || '').length}`)
    console.log(`   template chars:      ${(config.promptTemplate || '').length}`)
    if (!hasContextPlaceholder) {
        console.log('   ⚠️ Sin {context}: el LLM no recibira chunks/resultados en el user prompt.')
    }
    console.log()

    console.log('📦 Payload enviado a interpretPsychologicalTest:')
    console.log(`   testId:    ${TEST_ID}`)
    console.log(`   patientId: ${PATIENT_ID}`)
    console.log(`   items:     ${totalItems}`)
    console.log(`   raw:       ${JSON.stringify(rawResults)}`)
    console.log()

    const result = await interpretPsychologicalTest(TEST_ID, rawResults, PATIENT_ID)

    console.log()
    console.log('══════════════════════════════════════════════════════════')
    console.log('📋 INTERPRETACION GENERADA:')
    console.log('══════════════════════════════════════════════════════════')
    console.log(result.interpretation)
    console.log('══════════════════════════════════════════════════════════')

    const lowerInterpretation = (result.interpretation || '').toLowerCase()
    if (lowerInterpretation.includes('por favor comparta') || lowerInterpretation.includes('necesito que envies')) {
        console.log()
        console.log('⚠️ Alerta: la IA pidio datos en vez de usar los resultados del contexto.')
        console.log('   Revisa el promptTemplate en BD para confirmar que use {context}.')
    }

    if (result.metadata) {
        console.log()
        console.log('📊 Metadatos:')
        console.log(`   Documentos consultados: ${result.metadata.documentos_consultados?.join(', ')}`)
        console.log(`   Chunks utilizados:      ${result.metadata.chunks_utilizados}`)
        console.log(`   Modelo:                 ${result.metadata.modelo_usado}`)
        console.log(`   Tokens:                 ${result.metadata.tokens_usados}`)
    }
} catch (error) {
    console.error(`❌ Error en interpretacion ${TEST_ID}:`, error)
}
