import { generateAnswer } from './generator.js';
import { retrieveImproved } from './retriever.js';
import { getRagPsychologicalConfig, guardarResultadoPrueba } from './rag-config.js';

class PsychologicalInterpretationResult {
    constructor(interpretation, success, metadata) {
        this.interpretation = interpretation;
        this.success = success;
        this.metadata = {
            paciente_id: metadata.paciente_id,
            test_id: metadata.test_id,
            prompt_version: metadata.prompt_version,
            documentos_consultados: metadata.documentos_consultados,
            chunks_utilizados: metadata.chunks_utilizados,
            timestamp: new Date().toISOString(),
            ...metadata
        };
    }
}

// Constantes de retrieval — k=10 por query (carga completa), top 3 por aspecto base → máx 12 al LLM
const K_CANDIDATES = 10   // chunks a pedir a Qdrant por query
const K_PER_ASPECT = 3    // chunks a seleccionar por aspecto base → 4 aspectos × 3 = máx 12 total

/**
 * Genera queries bilingues (español + inglés) para los 4 aspectos normativos del test.
 * Estrategia: Multi-Query Bilingüe — cubre documentos en ambos idiomas sin filtros adicionales.
 *
 * @param {string} testId - ID del test ('ghq12' | 'dass21')
 * @returns {Array<{aspect: string, query: string}>}
 */
function generateNormativeQueries(testId) {
    const upperTestId = testId.toUpperCase();
    const baseQueries = [];

    if (upperTestId === 'GHQ12') {
        baseQueries.push(
            { aspect: 'reglas_puntuacion_en', query: 'GHQ-12 scoring method GHQ Likert binary bimodal score calculation' },
            { aspect: 'reglas_puntuacion_es', query: 'GHQ-12 método de puntuación reglas Likert puntuación binaria cálculo' },

            { aspect: 'puntos_corte_en', query: 'GHQ-12 cutoff threshold score sensitivity specificity screening classification' },
            { aspect: 'puntos_corte_es', query: 'GHQ-12 punto de corte umbral sensibilidad especificidad tamizaje clasificación' },

            { aspect: 'baremos_normativos_en', query: 'GHQ-12 normative data percentiles population reference scores ranges' },
            { aspect: 'baremos_normativos_es', query: 'GHQ-12 baremos normativos percentiles datos poblacionales puntajes de referencia' },

            { aspect: 'estructura_factorial_en', query: 'GHQ-12 factor structure subscales unidimensional validation psychometric' },
            { aspect: 'estructura_factorial_es', query: 'GHQ-12 estructura factorial subescalas validación unidimensional psicométrico' }
        );
    } else if (upperTestId === 'DASS21') {
        baseQueries.push(
            { aspect: 'reglas_puntuacion_en', query: 'DASS-21 scoring subscale sum multiply depression anxiety stress calculation' },
            { aspect: 'reglas_puntuacion_es', query: 'DASS-21 puntuación subescala suma multiplicar depresión ansiedad estrés cálculo' },

            { aspect: 'puntos_corte_en', query: 'DASS-21 cutoff severity levels normal mild moderate severe extremely severe' },
            { aspect: 'puntos_corte_es', query: 'DASS-21 punto de corte niveles de severidad normal leve moderado severo extremadamente severo' },

            { aspect: 'baremos_normativos_en', query: 'DASS-21 normative percentiles population reference ranges scores' },
            { aspect: 'baremos_normativos_es', query: 'DASS-21 baremos normativos percentiles población rangos de referencia puntajes' },

            { aspect: 'estructura_factorial_en', query: 'DASS-21 factor structure three subscales depression anxiety stress validation' },
            { aspect: 'estructura_factorial_es', query: 'DASS-21 estructura factorial tres subescalas depresión ansiedad estrés validación' }
        );
    }

    return baseQueries;
}

/**
 * Extrae nombres de documentos únicos de los chunks recuperados.
 */
function extractDocumentNames(chunks) {
    if (!chunks || !Array.isArray(chunks)) return [];
    const docNames = new Set();
    chunks.forEach(chunk => {
        const docName = chunk.payload?.docName || chunk.docName;
        if (docName) docNames.add(docName);
    });
    return Array.from(docNames);
}

/**
 * Elimina chunks con texto duplicado para no repetir contexto al LLM.
 * (Conservada por compatibilidad; la deduplicación principal la hace selectTopKPerAspect)
 */
// function removeDuplicateChunks(chunks) {
//     if (!chunks || chunks.length === 0) return [];
//     const uniqueChunks = [];
//     const seenTexts = new Set();
//     for (const chunk of chunks) {
//         const text = chunk.text?.trim();
//         if (text && !seenTexts.has(text)) {
//             seenTexts.add(text);
//             uniqueChunks.push(chunk);
//         }
//     }
//     return uniqueChunks;
// }

/**
 * Selecciona los top-K chunks por aspecto base (strip _en/_es suffix).
 * Agrupa los resultados de las 8 queries bilingues en 4 grupos de aspecto,
 * ordena por score DESC, deduplica por textHash, y toma los K mejores de cada grupo.
 * Garantiza cobertura de todos los aspectos con máx 12 chunks al LLM.
 *
 * @param {Array<{aspect: string, chunks: Array}>} allRetrievalResults
 * @param {number} topK - chunks por aspecto base (default K_PER_ASPECT = 3)
 * @returns {Array} máx topK × 4 chunks únicos con campo `aspectSource`
 */
function selectTopKPerAspect(allRetrievalResults, topK = K_PER_ASPECT) {
    const aspectGroups = {}
    for (const { aspect, chunks } of allRetrievalResults) {
        const baseAspect = aspect.replace(/_en$/, '').replace(/_es$/, '')
        if (!aspectGroups[baseAspect]) aspectGroups[baseAspect] = []
        aspectGroups[baseAspect].push(...chunks)
    }

    const selected = []
    const seenHashes = new Set()

    for (const baseAspect of Object.keys(aspectGroups)) {
        const sorted = aspectGroups[baseAspect]
            .sort((a, b) => (b.score || 0) - (a.score || 0))

        let taken = 0
        for (const chunk of sorted) {
            if (taken >= topK) break
            const hash = chunk.textHash || chunk.payload?.textHash || chunk.text || chunk.payload?.text
            if (!seenHashes.has(hash)) {
                seenHashes.add(hash)
                selected.push({ ...chunk, aspectSource: baseAspect })
                taken++
            }
        }
    }

    return selected
}

/**
 * Función principal: interpreta el resultado de un test psicológico usando RAG.
 * El system prompt y el prompt template se cargan SIEMPRE desde la BD.
 *
 * @param {string} testId - 'ghq12' | 'dass21'
 * @param {Object} rawResults - Resultados crudos del paciente
 * @param {string} patientId - Teléfono / ID del paciente
 * @returns {Promise<PsychologicalInterpretationResult>}
 */
export async function interpretPsychologicalTest(testId, rawResults, patientId) {
    try {
        console.log(`🧠 Iniciando interpretación para ${testId} - Paciente: ${patientId}`);

        // 1. VALIDACIÓN
        if (!testId || !rawResults || !patientId) {
            throw new Error('Parámetros requeridos: testId, rawResults, patientId');
        }
        if (!['ghq12', 'dass21'].includes(testId.toLowerCase())) {
            throw new Error(`Test no soportado: ${testId}. Tests soportados: ghq12, dass21`);
        }

        // 2. CARGAR CONFIGURACIÓN DESDE BD
        console.log('📚 Cargando configuración RAG desde BD...');
        const config = await getRagPsychologicalConfig();

        // 3. RETRIEVAL BILINGÜE — 8 queries (4 aspectos × 2 idiomas)
        const normativeQueries = generateNormativeQueries(testId);
        console.log(`🔎 Ejecutando ${normativeQueries.length} queries bilingues para ${testId}...`);

        const allRetrievalResults = [];
        for (const queryObj of normativeQueries) {
            console.log(`  📋 [${queryObj.aspect}] "${queryObj.query}"`);
            const result = await retrieveImproved(queryObj.query, { k: K_CANDIDATES });

            if (result.chunks && result.chunks.length > 0) {
                allRetrievalResults.push({
                    aspect: queryObj.aspect,
                    chunks: result.chunks,
                    sources: result.sources
                });
                console.log(`    ✅ ${result.chunks.length} chunks recuperados`);
            }
        }

        // 4. TOP-K POR ASPECTO — selecciona los mejores K chunks por grupo de aspecto
        // Agrupa las 8 queries bilingues en 4 aspectos base, toma top K_PER_ASPECT por grupo
        const uniqueChunks = selectTopKPerAspect(allRetrievalResults);

        console.log(`📄 Total chunks únicos: ${uniqueChunks.length}`);

        if (uniqueChunks.length === 0) {
            throw new Error(`No se encontraron documentos relevantes para ${testId}`);
        }

        // 5. GENERACIÓN — incluye datos del paciente como chunk virtual
        console.log('🤖 Generando interpretación...');
        const enhancedChunks = [
            {
                text: `Datos del paciente: ${JSON.stringify(rawResults)}`,
                payload: { docName: 'Datos_Paciente', chunkIndex: 0, paciente_id: patientId }
            },
            ...uniqueChunks
        ];

        const testLabel = testId.toUpperCase().replace('GHQ12', 'GHQ-12').replace('DASS21', 'DASS-21');

        const generationResult = await generateAnswer(testLabel, enhancedChunks, {
            systemPrompt: config.systemInstructions,
            userPromptTemplate: config.promptTemplate,
            maxTokens: 2000
        });

        if (!generationResult.success) {
            throw new Error('Error en generación de interpretación');
        }

        // 6. METADATOS Y GUARDADO
        const interpretationMetadata = {
            paciente_id: patientId,
            test_id: testId,
            prompt_version: config.version,
            documentos_consultados: extractDocumentNames(uniqueChunks),
            chunks_utilizados: uniqueChunks.length,
            resultados_crudos: rawResults,
            modelo_usado: generationResult.metadata?.model,
            tokens_usados: generationResult.metadata?.totalTokens,
            estrategia_retrieval: 'multi-query-bilingual'
        };

        console.log('💾 Guardando interpretación en historial...');
        await guardarResultadoPrueba(
            patientId,
            `interpretacion_${testId}`,
            {
                interpretacion_tecnica: generationResult.answer,
                metadata: interpretationMetadata,
                fecha_interpretacion: new Date().toISOString()
            }
        );

        console.log(`✅ Interpretación ${testId} completada — documentos: ${interpretationMetadata.documentos_consultados.join(', ')}`);

        return new PsychologicalInterpretationResult(
            generationResult.answer,
            true,
            interpretationMetadata
        );

    } catch (error) {
        console.error(`❌ Error en interpretación ${testId}:`, error);

        return new PsychologicalInterpretationResult(
            'Lo siento, hubo un error al interpretar los resultados.',
            false,
            {
                paciente_id: patientId,
                test_id: testId,
                error: error.message,
                timestamp: new Date().toISOString()
            }
        );
    }
}
