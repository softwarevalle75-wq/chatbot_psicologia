// Función de prueba integrada en ghq12.js
export async function testRAGIntegration() {
    console.log('🚀 INICIANDO PRUEBA DE INTEGRACIÓN RAG...');

    try {
        console.log('📦 Importando módulo RAG...');
        // Importar el módulo RAG
        const { interpretPsychologicalTest } = await import('../../RAG/psychological-interpreter.js');
        console.log('✅ Módulo RAG importado correctamente');

        // Datos de prueba simples
        const testResults = {
            0: [1, 3, 5], // Mejor que lo habitual
            1: [2, 4],    // Igual que lo habitual
            2: [6],       // Menos que lo habitual
            3: []         // Mucho menos que lo habitual
        };

        console.log('🔍 Ejecutando interpretación de prueba...');
        console.log('📊 Datos de prueba:', JSON.stringify(testResults, null, 2));

        const result = await interpretPsychologicalTest('ghq12', testResults, 'test_patient_001');

        console.log('✅ Interpretación completada exitosamente!');
        console.log('📝 Longitud del resultado:', result.interpretation.length, 'caracteres');
        console.log('📊 Metadatos:');
        console.log('   - Éxito:', result.success);
        console.log('   - Test ID:', result.metadata.test_id);
        console.log('   - Documentos consultados:', result.metadata.documentos_consultados?.length || 0);
        console.log('   - Chunks utilizados:', result.metadata.chunks_utilizados);
        console.log('   - Prompt version:', result.metadata.prompt_version);

        console.log('🎉 PRUEBA COMPLETADA EXITOSAMENTE');
        return result;

    } catch (error) {
        console.error('❌ ERROR EN PRUEBA RAG:', error.message);
        console.error('📍 Ubicación del error:', error.stack?.split('\n')[1] || 'Desconocida');
        throw error;
    }
}

// Ejecutar prueba si se llama directamente
console.log('🔧 Script cargado, ejecutando prueba...');
testRAGIntegration()
    .then(() => {
        console.log('✅ Script finalizado correctamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script finalizado con error');
        process.exit(1);
    });
