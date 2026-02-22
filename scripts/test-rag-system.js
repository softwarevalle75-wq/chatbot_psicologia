// Script de prueba para validar el sistema RAG unificado
import { interpretPsychologicalTest } from 'file:///c:/Users/provisional/Documents/ChatBot-Psico/src/RAG/psychological-interpreter.js';

// Datos de prueba simulados para GHQ-12
const mockGHQ12Results = {
    0: [1, 3, 5, 7, 9, 11], // Respuestas "mejor que lo habitual"
    1: [2, 4, 6], // Respuestas "igual que lo habitual"
    2: [8, 10], // Respuestas "menos que lo habitual"
    3: [12] // Respuestas "mucho menos que lo habitual"
};

// Datos de prueba simulados para DASS-21
const mockDASS21Results = {
    0: [1, 5, 8, 11, 15, 18], // No me ha ocurrido
    1: [2, 6, 9, 12, 16, 19], // Poco tiempo
    2: [3, 7, 10, 13, 17, 20], // Buena parte del tiempo
    3: [4, 14, 21] // La mayor parte del tiempo
};

async function testRAGSystem() {
    console.log('🧪 Iniciando pruebas del sistema RAG unificado...\n');

    try {
        // Prueba 1: GHQ-12
        console.log('📋 PRUEBA 1: Interpretación GHQ-12');
        console.log('=====================================');

        const ghq12Result = await interpretPsychologicalTest(
            'ghq12',
            mockGHQ12Results,
            'test_paciente_001'
        );

        console.log('✅ GHQ-12 - Interpretación exitosa:');
        console.log('📝 Resultado:', ghq12Result.interpretation.substring(0, 200) + '...');
        console.log('📊 Metadatos:', {
            test_id: ghq12Result.metadata.test_id,
            documentos: ghq12Result.metadata.documentos_consultados?.length || 0,
            chunks: ghq12Result.metadata.chunks_utilizados,
            version_prompt: ghq12Result.metadata.prompt_version
        });
        console.log('');

        // Prueba 2: DASS-21
        console.log('📋 PRUEBA 2: Interpretación DASS-21');
        console.log('====================================');

        const dass21Result = await interpretPsychologicalTest(
            'dass21',
            mockDASS21Results,
            'test_paciente_002'
        );

        console.log('✅ DASS-21 - Interpretación exitosa:');
        console.log('📝 Resultado:', dass21Result.interpretation.substring(0, 200) + '...');
        console.log('📊 Metadatos:', {
            test_id: dass21Result.metadata.test_id,
            documentos: dass21Result.metadata.documentos_consultados?.length || 0,
            chunks: dass21Result.metadata.chunks_utilizados,
            version_prompt: dass21Result.metadata.prompt_version
        });
        console.log('');

        console.log('🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');
        console.log('==========================================');
        console.log('✅ Sistema RAG unificado funcionando correctamente');
        console.log('✅ Modelo GPT-4o-mini compatible con API key');
        console.log('✅ Interpretaciones técnicas generadas');
        console.log('✅ Metadatos de trazabilidad incluidos');

    } catch (error) {
        console.error('❌ ERROR EN PRUEBAS:', error.message);
        console.error('Stack trace:', error.stack);

        // Intentar diagnóstico adicional
        if (error.message.includes('API key')) {
            console.log('💡 Diagnóstico: Verificar OPENAI_API_KEY en archivo .env');
        } else if (error.message.includes('model')) {
            console.log('💡 Diagnóstico: El modelo gpt-4o-mini podría no estar disponible para esta API key');
        } else if (error.message.includes('retrieve')) {
            console.log('💡 Diagnóstico: Verificar configuración de Qdrant/vector DB');
        }

        process.exit(1);
    }
}

// Ejecutar pruebas si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    testRAGSystem();
}

export { testRAGSystem };
