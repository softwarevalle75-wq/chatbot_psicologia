// Sistema Unificado de Interpretación RAG para Tests Psicológicos
// Arquitectura: Prompt General Inteligente que funciona para todos los tests

import { generateAnswer } from './generator.js';
import { retrieveImproved } from './retriever-improved.js';
import { getRagPsychologicalConfig, guardarResultadoPrueba } from '../queries/queries.js';

/**
 * Resultado de interpretación psicológica
 * Principio: Encapsulation - estructura clara para resultados
 */
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

/**
 * Determina el valor óptimo de k para retrieval basado en la complejidad de la query
 * Arquitectura: Dynamic k - ajustar retrieval según tipo de consulta
 *
 * @param {string} query - Query a analizar
 * @returns {number} Valor de k (5-10)
 */
function determineRetrievalK(query) {
    const normativeKeywords = ['puntos de corte', 'baremos', 'normativos', 'puntuación', 'corte', 'clasificación', 'reglas', 'estructura'];
    const isNormative = normativeKeywords.some(keyword => query.toLowerCase().includes(keyword));
    return isNormative ? 5 : 3; // k reducido para controlar total chunks
}

/**
 * Genera queries separadas para diferentes aspectos normativos del test
 * Arquitectura: Multi-Query Strategy - consultas especializadas para mejor recall
 *
 * @param {string} testId - ID del test
 * @returns {Array} Array de objetos {aspect, query}
 */
function generateNormativeQueries(testId) {
    const upperTestId = testId.toUpperCase();
    const baseQueries = [];

    if (upperTestId === 'GHQ12') {
        baseQueries.push(
            { aspect: 'reglas_puntuacion', query: 'GHQ-12 reglas de puntuación método GHQ scoring vs Likert' },
            { aspect: 'puntos_corte', query: 'GHQ-12 puntos de corte clasificación casos probable no caso' },
            { aspect: 'baremos_normativos', query: 'GHQ-12 baremos normativos rangos percentiles puntuaciones' },
            { aspect: 'estructura_factorial', query: 'GHQ-12 estructura factorial subescalas factores validados' }
        );
    } else if (upperTestId === 'DASS21') {
        baseQueries.push(
            { aspect: 'reglas_puntuacion', query: 'DASS-21 reglas puntuación sumatoria subescalas depresión ansiedad estrés' },
            { aspect: 'puntos_corte', query: 'DASS-21 puntos corte severidad normal leve moderada severa extrema' },
            { aspect: 'baremos_normativos', query: 'DASS-21 baremos normativos percentiles rangos referencia' },
            { aspect: 'estructura_factorial', query: 'DASS-21 estructura factorial subescalas depresión ansiedad estrés validadas' }
        );
    }

    return baseQueries;
}

/**
 * Construye query inteligente para retrieval de tests psicológicos
 * Principio: Query Engineering - optimizar para encontrar información relevante
 *
 * @param {string} testId - ID del test
 * @returns {string} Query optimizada
 */
function buildPsychologicalQuery(testId) {
    const testNames = {
        'ghq12': 'GHQ-12',
        'dass21': 'DASS-21'
    };

    return testNames[testId.toLowerCase()] || testId.toUpperCase();
}

/**
 * Extrae nombres de documentos únicos de los chunks
 * Principio: Data Processing - procesamiento limpio de metadatos
 *
 * @param {Array} chunks - Chunks recuperados
 * @returns {Array<string>} Nombres únicos de documentos
 */
function extractDocumentNames(chunks) {
    if (!chunks || !Array.isArray(chunks)) return [];

    const docNames = new Set();
    chunks.forEach(chunk => {
        if (chunk.payload?.docName) {
            docNames.add(chunk.payload.docName);
        }
    });

    return Array.from(docNames);
}

/**
 * Elimina chunks duplicados basándose en contenido similar
 * Arquitectura: Deduplication - evitar redundancia en contexto
 *
 * @param {Array} chunks - Array de chunks
 * @returns {Array} Chunks únicos
 */
function removeDuplicateChunks(chunks) {
    if (!chunks || chunks.length === 0) return [];

    const uniqueChunks = [];
    const seenTexts = new Set();

    for (const chunk of chunks) {
        const text = chunk.text?.trim();
        if (text && !seenTexts.has(text)) {
            seenTexts.add(text);
            uniqueChunks.push(chunk);
        }
    }

    return uniqueChunks;
}

/**
 * Función principal unificada para interpretación de tests psicológicos
 * Arquitectura: Prompt General + RAG Inteligente
 *
 * @param {string} testId - ID del test ('ghq12', 'dass21', etc.)
 * @param {Object} rawResults - Resultados crudos del paciente
 * @param {string} patientId - ID del paciente
 * @returns {Promise<PsychologicalInterpretationResult>} Resultado de interpretación
 */
export async function interpretPsychologicalTest(testId, rawResults, patientId) {
    try {
        console.log(`🧠 Iniciando interpretación unificada para ${testId} - Paciente: ${patientId}`);

        // 1. VALIDACIÓN DE INPUTS (Fail Fast)
        if (!testId || !rawResults || !patientId) {
            throw new Error('Parámetros requeridos: testId, rawResults, patientId');
        }

        if (!['ghq12', 'dass21'].includes(testId.toLowerCase())) {
            throw new Error(`Test no soportado: ${testId}. Tests soportados: ghq12, dass21`);
        }

        // 2. CARGAR CONFIGURACIÓN GENERAL DEL PROMPT
        console.log('📚 Cargando configuración RAG general...');
        const config = await getRagPsychologicalConfig();

        // 3. CONSTRUIR QUERIES NORMATIVAS SEPARADAS
        console.log(`🔍 Generando queries normativas para ${testId}...`);
        const normativeQueries = generateNormativeQueries(testId);
        
        // 4. RETRIEVAL MULTIPLE PARA DIFERENTES ASPECTOS NORMATIVOS
        console.log(`🔎 Ejecutando retrieval múltiple para ${normativeQueries.length} aspectos normativos...`);
        
        const allRetrievalResults = [];
        for (const queryObj of normativeQueries) {
            console.log(`  📋 Consultando: ${queryObj.aspect} - "${queryObj.query}"`);
            
            const k = determineRetrievalK(queryObj.query);
            const result = await retrieveImproved(queryObj.query, {
                k: k
            });
            
            if (result.chunks && result.chunks.length > 0) {
                allRetrievalResults.push({
                    aspect: queryObj.aspect,
                    query: queryObj.query,
                    chunks: result.chunks,
                    sources: result.sources
                });
                console.log(`    ✅ ${result.chunks.length} chunks recuperados`);
            }
        }
        
        // COMBINAR TODOS LOS CHUNKS RECUPERADOS
        const allChunks = allRetrievalResults.flatMap(result => result.chunks);
        const uniqueChunks = removeDuplicateChunks(allChunks); // Evitar duplicados
        
        const retrievalResult = {
            chunks: uniqueChunks,
            sources: [...new Set(allRetrievalResults.flatMap(r => r.sources || []))],
            normativeAspects: allRetrievalResults.map(r => r.aspect)
        };
        
        console.log(`📄 Total chunks únicos: ${uniqueChunks.length} de ${allRetrievalResults.length} aspectos normativos`);

        if (!retrievalResult.chunks || retrievalResult.chunks.length === 0) {
            throw new Error(`No se encontraron documentos relevantes para ${testId}`);
        }

        console.log(`📄 Recuperados ${retrievalResult.chunks.length} chunks de ${retrievalResult.sources?.length || 0} documentos`);

        // 5. GENERACIÓN CON PROMPT GENERAL
        console.log('🤖 Generando interpretación con prompt general...');
        
        // Incluir datos del paciente en el contexto para que RAG pueda analizarlos
        const patientDataContext = `Datos del paciente: ${JSON.stringify(rawResults)}`;
        const enhancedChunks = [
            // Agregar chunk virtual con datos del paciente
            {
                text: patientDataContext,
                payload: { 
                    docName: 'Datos_Paciente',
                    chunkIndex: 0,
                    paciente_id: patientId
                }
            },
            ...retrievalResult.chunks // Chunks del RAG
        ];
        
        const query = buildPsychologicalQuery(testId);
        
        const generationResult = await generateAnswer(query, enhancedChunks, {
            systemPrompt: config.systemInstructions, // Rol del sistema
            userPromptTemplate: config.promptTemplate, // Instrucciones detalladas
            testId: testId,
            temperature: 0.2, // Más determinista para análisis técnicos
            maxTokens: 2000 // Espacio suficiente para análisis detallados
        });

        if (!generationResult.success) {
            throw new Error('Error en generación de interpretación');
        }

        // 6. CONSTRUIR METADATOS COMPLETOS PARA TRAZABILIDAD
        const interpretationMetadata = {
            paciente_id: patientId,
            test_id: testId,
            prompt_version: config.version,
            documentos_consultados: extractDocumentNames(retrievalResult.chunks),
            chunks_utilizados: retrievalResult.chunks.length,
            resultados_crudos: rawResults,
            modelo_usado: generationResult.metadata?.model,
            tokens_usados: generationResult.metadata?.totalTokens,
            estrategia_retrieval: 'unified-rag'
        };

        // 7. GUARDAR RESULTADO EN HISTORIAL
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

        console.log(`✅ Interpretación ${testId} completada exitosamente`);

        return new PsychologicalInterpretationResult(
            generationResult.answer,
            true,
            interpretationMetadata
        );

    } catch (error) {
        console.error(`❌ Error en interpretación ${testId}:`, error);

        // Retornar resultado de error con metadatos mínimos
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

/**
 * Construye query inteligente para retrieval de tests psicológicos
 * Principio: Query Engineering - optimizar para encontrar información relevante
function extractDocumentNames(chunks) {
    if (!chunks || !Array.isArray(chunks)) return [];

    const docNames = new Set();
    chunks.forEach(chunk => {
        if (chunk.payload?.docName) {
            docNames.add(chunk.payload.docName);
        }
    });

    return Array.from(docNames);
}

/**
 * Función de validación para tests soportados
 * Principio: Input Validation - validar antes de procesar
 *
 * @param {string} testId - ID del test a validar
 * @returns {boolean} True si es soportado
 */
export function isSupportedTest(testId) {
    const supportedTests = ['ghq12', 'dass21'];
    return supportedTests.includes(testId.toLowerCase());
}

/**
 * Función utilitaria para obtener estadísticas de uso
 * Principio: Monitoring - métricas para optimización
 */
export async function getInterpretationStats() {
    throw new Error('Not implemented')
}
