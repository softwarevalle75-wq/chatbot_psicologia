// Test completamente aislado del RAG - sin dependencias de BD ni WhatsApp
import 'dotenv/config';
import { generateAnswer } from '../src/RAG/generator.js';
import { retrieveImproved } from '../src/RAG/retriever-improved.js';

// Configuración RAG hardcodeada para evitar BD
const RAG_CONFIG = {
    systemInstructions: `Actúa como psicólogo clínico y psicometrista especializado en interpretación técnica de pruebas psicológicas basándose exclusivamente en manuales normativos oficiales proporcionados en cada solicitud. Analiza los resultados únicamente con base en los documentos entregados. Está prohibido utilizar conocimiento externo, realizar suposiciones no respaldadas o emitir diagnósticos clínicos definitivos. Solo podrás formular hipótesis diagnósticas tentativas si el manual lo permite explícitamente, indicando el nivel de probabilidad y su fundamento normativo. Tu análisis debe: - Identificar el instrumento aplicado. - Extraer puntos de corte, baremos y criterios interpretativos del manual. - Comparar explícitamente cada puntaje con dichos criterios. - Evaluar coherencia interna del perfil según la estructura del instrumento. - Integrar los hallazgos de forma técnica y prudente. Mantén un lenguaje profesional, objetivo y claro. Evita afirmaciones categóricas o alarmistas. La respuesta debe garantizar que todos los puntajes fueron contrastados con el manual, incluir limitaciones metodológicas cuando corresponda y finalizar con una advertencia ética indicando que la interpretación es orientativa y no sustituye evaluación clínica profesional presencial.`,
    version: '1.0'
};

async function testRAGCompletoAislado() {
    console.log('🧪 Test RAG aislado - Paciente GHQ-12 con máxima severidad...\n');

    // Datos del paciente con máxima severidad (3 en todas las preguntas)
    const testId = 'ghq12';
    const rawResults = {
        0: [], // Mejor que habitual: 0
        1: [], // Igual que habitual: 0
        2: [], // Menos que habitual: 0
        3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] // Mucho menos que habitual: TODAS
    };

    console.log('📊 Perfil del paciente:');
    console.log(`   - ${rawResults[0].length} respuestas "Mejor que habitual"`);
    console.log(`   - ${rawResults[1].length} respuestas "Igual que habitual"`);
    console.log(`   - ${rawResults[2].length} respuestas "Menos que habitual"`);
    console.log(`   - ${rawResults[3].length} respuestas "Mucho menos que habitual"`);
    console.log('   → PERFIL DE MÁXIMA SEVERIDAD\n');

    try {
        // 1. Construir query inteligente
        const query = `Interpretar resultados de prueba psicológica.
Instrumento: GHQ-12
Resultados del paciente: ${JSON.stringify(rawResults)}
Analizar según criterios técnicos de los manuales disponibles.
Comparar con baremos, puntos de corte, subescalas y criterios normativos.
Proporcionar interpretación técnica fundamentada.`;

        console.log('🔍 Query para RAG:');
        console.log(query.substring(0, 150) + '...\n');

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

        // 3. Generar interpretación con OpenAI
        console.log('\n🤖 Generando interpretación con GPT-5...');
        const generationResult = await generateAnswer(query, retrievalResult.chunks, {
            customPrompt: RAG_CONFIG.systemInstructions,
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
        console.log(`   - Modelo usado: ${generationResult.metadata?.model}`);
        console.log(`   - Chunks utilizados: ${retrievalResult.chunks.length}`);
        console.log(`   - Tokens usados: ${generationResult.metadata?.totalTokens || 'N/A'}`);

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
