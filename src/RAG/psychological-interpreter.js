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

// Constantes de retrieval — k=10 por query (carga completa), top 3 por aspecto base → max 12 al LLM
const K_CANDIDATES = 10
const K_PER_ASPECT = 2

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

function extractDocumentNames(chunks) {
    if (!chunks || !Array.isArray(chunks)) return [];
    const docNames = new Set();
    chunks.forEach(chunk => {
        const docName = chunk.payload?.docName || chunk.docName;
        if (docName) docNames.add(docName);
    });
    return Array.from(docNames);
}

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

function buildItemScores(rawResults) {
    const itemScores = []
    for (const score of [0, 1, 2, 3]) {
        const items = Array.isArray(rawResults?.[score]) ? rawResults[score] : []
        for (const item of items) {
            itemScores.push({ item: Number(item), score })
        }
    }
    return itemScores
        .filter(entry => Number.isFinite(entry.item))
        .sort((a, b) => a.item - b.item)
}

function buildPatientData(patientId, testId, rawResults) {
    const itemScores = buildItemScores(rawResults)
    return {
        paciente_id: patientId,
        test_id: testId,
        total_items_respondidos: itemScores.length
    }
}

function buildItemScoresCompact(rawResults) {
    const rows = []
    for (const score of [0, 1, 2, 3]) {
        const items = Array.isArray(rawResults?.[score]) ? rawResults[score] : []
        for (const item of items) {
            const itemNumber = Number(item)
            if (Number.isFinite(itemNumber)) rows.push({ item: itemNumber, score })
        }
    }

    return rows
        .sort((a, b) => a.item - b.item)
        .map(({ item, score }) => `${item}=${score}`)
        .join(', ')
}

function compactInterpretation(text, maxLength = 900) {
    if (!text) return 'Sin interpretación disponible.'
    const singleLine = String(text)
        .replace(/\r\n/g, '\n')
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (singleLine.length <= maxLength) return singleLine
    return `${singleLine.slice(0, maxLength - 3).trim()}...`
}

export async function interpretPsychologicalTest(testId, rawResults, patientId) {
    try {
        console.log(`🧠 Iniciando interpretación para ${testId} - Paciente: ${patientId}`);

        if (!testId || !rawResults || !patientId) {
            throw new Error('Parámetros requeridos: testId, rawResults, patientId');
        }
        if (!['ghq12', 'dass21'].includes(testId.toLowerCase())) {
            throw new Error(`Test no soportado: ${testId}. Tests soportados: ghq12, dass21`);
        }

        console.log('📚 Cargando configuración RAG desde BD...');
        const config = await getRagPsychologicalConfig();
        const retrievalSource = testId.toLowerCase() === 'ghq12' ? 'GHQ-12' : 'DASS-21'

        const normativeQueries = generateNormativeQueries(testId);
        console.log(`🔎 Ejecutando ${normativeQueries.length} queries bilingues para ${testId}...`);

        const allRetrievalResults = [];
        for (const queryObj of normativeQueries) {
            console.log(`  📋 [${queryObj.aspect}] "${queryObj.query}"`);
            const result = await retrieveImproved(queryObj.query, { k: K_CANDIDATES, source: retrievalSource });

            if (result.chunks && result.chunks.length > 0) {
                allRetrievalResults.push({
                    aspect: queryObj.aspect,
                    chunks: result.chunks,
                    sources: result.sources
                });
                console.log(`    ✅ ${result.chunks.length} chunks recuperados`);
            }
        }

        const uniqueChunks = selectTopKPerAspect(allRetrievalResults);

        console.log(`📄 Total chunks únicos: ${uniqueChunks.length}`);

        if (uniqueChunks.length === 0) {
            throw new Error(`No se encontraron documentos relevantes para ${testId}`);
        }

        console.log('🤖 Generando interpretación...');
        const enhancedChunks = [
            {
                text: `Datos del paciente: ${JSON.stringify(rawResults)}`,
                payload: { docName: 'Datos_Paciente', chunkIndex: 0, paciente_id: patientId }
            },
            ...uniqueChunks
        ];

        const testLabel = testId.toUpperCase().replace('GHQ12', 'GHQ-12').replace('DASS21', 'DASS-21');
        const itemScores = buildItemScores(rawResults)
        const patientData = buildPatientData(patientId, testId, rawResults)

        const generationResult = await generateAnswer(testLabel, enhancedChunks, {
            systemPrompt: config.systemInstructions,
            userPromptTemplate: config.promptTemplate,
            patientData,
            rawResults,
            itemScores,
            maxTokens: 4200
        });

        if (!generationResult.success) {
            throw new Error('Error en generación de interpretación');
        }

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
        const itemScoresCompact = buildItemScoresCompact(rawResults)
        const shortInterpretation = compactInterpretation(generationResult.answer)

        await guardarResultadoPrueba(
            patientId,
            `interpretacion_${testId}`,
            [
                `test=${testId}`,
                `fecha=${new Date().toISOString()}`,
                `items=${itemScoresCompact}`,
                `resumen=${shortInterpretation}`
            ].join('\n')
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
