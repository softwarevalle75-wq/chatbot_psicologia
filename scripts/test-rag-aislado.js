// Test completamente aislado del RAG - sin dependencias de BD ni WhatsApp
import { retrieveImproved } from '../src/RAG/retriever-improved.js';
import { generateAnswer } from '../src/RAG/generator.js';
import { getRagPsychologicalConfig } from '../src/queries/queries.js';

// Función optimizada para construir query minimal
function buildOptimizedQuery(testId, rawResults) {
    const testNames = { 'ghq12': 'GHQ-12', 'dass21': 'DASS-21' };
    return testNames[testId.toLowerCase()] || testId.toUpperCase();
}

// Función para crear contexto con datos del paciente
function buildContextWithPatientData(retrievedChunks, rawResults) {
    const patientChunk = {
        text: `Datos del paciente: ${JSON.stringify(rawResults)}`,
        payload: { docName: 'Datos_Paciente', chunkIndex: 0 }
    };
    return [patientChunk, ...retrievedChunks];
}

// Configuración RAG desde BD

async function testRAGCompletoAislado() {
    const RAG_CONFIG = await getRagPsychologicalConfig();
    console.log('🧪 Test RAG aislado - Paciente GHQ-12 con perfil REALISTA...\n');

    // Datos del paciente REALISTA (perfil mixto de distress moderado)
    const testId = 'ghq12';
    const rawResults = {
        0: [1, 4, 7, 10], // Mejor que habitual: 4 ítems (respuestas normales)
        1: [], // Igual que habitual: 0
        2: [2, 5, 8, 9, 11, 12], // Menos que habitual: 6 ítems (distress leve-moderado)
        3: [3, 6] // Mucho menos que habitual: 2 ítems (distress significativo)
    };

    console.log('📊 Perfil del paciente:');
    console.log(`   - ${rawResults[0].length} respuestas "Mejor que habitual"`);
    console.log(`   - ${rawResults[1].length} respuestas "Igual que habitual"`);
    console.log(`   - ${rawResults[2].length} respuestas "Menos que habitual"`);
    console.log(`   - ${rawResults[3].length} respuestas "Mucho menos que habitual"`);
    console.log('   → PERFIL REALISTA: DISTRESS MODERADO\n');

    try {
        // 1. Construir query ultra-minimal optimizada
        const query = buildOptimizedQuery(testId, rawResults);

        console.log('🔍 Query para RAG:');
        console.log(`"${query}"\n`);

        // 2. Retrieval desde Qdrant
        console.log('🔎 Ejecutando retrieval de documentos GHQ-12...');
        const retrievalResult = await retrieveImproved(query, {
            source: 'GHQ-12', // Corregido: coincide con datos en Qdrant
            k: 5 // Reducido de 15 a 5 para probar si el contexto grande consume demasiados tokens
        });

        console.log(`✅ Recuperados ${retrievalResult.chunks?.length || 0} chunks`);
        if (retrievalResult.sources) {
            console.log(`📚 Fuentes: ${retrievalResult.sources.join(', ')}`);
        }

        if (!retrievalResult.chunks || retrievalResult.chunks.length === 0) {
            console.log('❌ No se encontraron documentos relevantes');
            return;
        }

        // 3. Crear contexto con datos del paciente incluidos
        console.log('\n🤖 Construyendo contexto con datos del paciente...');
        const enhancedChunks = buildContextWithPatientData(retrievalResult.chunks, rawResults);

        // 4. Generar interpretación con GPT-5
        console.log('🤖 Generando interpretación con GPT-5...');
        const generationResult = await generateAnswer(query, enhancedChunks, {
            systemPrompt: RAG_CONFIG.systemInstructions,
            userPromptTemplate: RAG_CONFIG.promptTemplate,
            testId: testId,
            temperature: 0.2,
            maxTokens: 2000
        });

        if (!generationResult.success) {
            console.log('❌ Error en generación de respuesta');
            return;
        }

        // 4. Mostrar resultados
        console.log('\n🎉 ¡INTERPRETACIÓN GENERADA EXITOSAMENTE!\n');
        console.log('═'.repeat(80));
        console.log(generationResult.answer);
        console.log('═'.repeat(80));

        console.log('\n📊 Metadatos:');
        console.log(`   - Modelo usado: ${generationResult.metadata?.model || 'gpt-5'}`);
        console.log(`   - Chunks utilizados: ${enhancedChunks.length}`);
        console.log(`   - Tokens usados: ${generationResult.metadata?.totalTokens || 'N/A'}`);
        console.log(`   - Query usado: "${query}"`);

        // 5. Verificar calidad de la interpretación
        const respuesta = generationResult.answer.toLowerCase();
        const indicadoresSeveridad = [
            'sever', 'alto', 'significativ', 'preocupante', 'riesgo',
            'deterioro', 'alteración', 'síntomas', 'intervención'
        ];

        const severidadDetectada = indicadoresSeveridad.some(indicador =>
            respuesta.includes(indicador)
        );

        if (severidadDetectada) {
            console.log('\n✅ ¡EXCELENTE! La interpretación detecta correctamente la alta severidad');
            console.log('🎯 El RAG está funcionando perfectamente para casos de alta severidad');
        } else {
            console.log('\n⚠️  La interpretación podría no estar detectando la severidad');
        }

    } catch (error) {
        console.error('❌ Error en test RAG:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testRAGCompletoAislado();
