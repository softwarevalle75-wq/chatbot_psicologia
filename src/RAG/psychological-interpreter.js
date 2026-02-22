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

        // 3. CONSTRUIR QUERY INTELIGENTE PARA RETRIEVAL
        const query = buildPsychologicalQuery(testId, rawResults);
        console.log(`🔍 Query construida: ${query.substring(0, 100)}...`);

        // 4. RETRIEVAL INTELIGENTE - Busca automáticamente en documentos del test
        console.log(`🔎 Ejecutando retrieval para ${testId.toUpperCase()}...`);
        const retrievalResult = await retrieveImproved(query, {
            source: testId.toUpperCase(), // Filtra automáticamente por documentos del test
            k: 20 // Más chunks para contexto completo
        });

        if (!retrievalResult.chunks || retrievalResult.chunks.length === 0) {
            throw new Error(`No se encontraron documentos relevantes para ${testId}`);
        }

        console.log(`📄 Recuperados ${retrievalResult.chunks.length} chunks de ${retrievalResult.sources?.length || 0} documentos`);

        // 5. GENERACIÓN CON PROMPT GENERAL
        console.log('🤖 Generando interpretación con prompt general...');
        const generationResult = await generateAnswer(query, retrievalResult.chunks, {
            customPrompt: config.systemInstructions, // Prompt general inteligente
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
 *
 * @param {string} testId - ID del test
 * @param {Object} rawResults - Resultados crudos
 * @returns {string} Query optimizada
 */
function buildPsychologicalQuery(testId, rawResults) {
    const testNames = {
        'ghq12': 'GHQ-12',
        'dass21': 'DASS-21'
    };

    const testName = testNames[testId.toLowerCase()] || testId.toUpperCase();

    // Query estructurada que incluye identificación automática del test
    return `Interpretar resultados de prueba psicológica.
Instrumento: ${testName}
Resultados del paciente: ${JSON.stringify(rawResults)}
Analizar según criterios técnicos de los manuales disponibles.
Comparar con baremos, puntos de corte, subescalas y criterios normativos.
Proporcionar interpretación técnica fundamentada.`;
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
    try {
        // Implementar estadísticas de uso si es necesario
        return {
            status: 'not_implemented',
            message: 'Estadísticas de interpretación no implementadas aún'
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return { status: 'error', error: error.message };
    }
}

// Exportar clase para testing y extensibilidad
export { PsychologicalInterpretationResult };
