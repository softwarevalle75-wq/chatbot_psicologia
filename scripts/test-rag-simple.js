// Test simple de imports y configuración RAG
import 'dotenv/config';
import { getRagPsychologicalConfig } from '../src/queries/queries.js';

async function simpleRAGTest() {
    console.log('🧪 Test simple de configuración RAG...\n');

    try {
        console.log('1️⃣ Probando configuración de BD...');
        const config = await getRagPsychologicalConfig();
        console.log('✅ Configuración obtenida:');
        console.log('   - ID:', config.id);
        console.log('   - Versión:', config.version);
        console.log('   - Longitud S.I.:', config.systemInstructions?.length || 0, 'caracteres');
        console.log('   - Longitud Prompt:', config.promptTemplate?.length || 0, 'caracteres\n');

        console.log('2️⃣ Probando import de módulos RAG...');
        const { generateAnswer } = await import('../src/RAG/generator.js');
        const { retrieveImproved } = await import('../src/RAG/retriever-improved.js');
        const { interpretPsychologicalTest } = await import('../src/RAG/psychological-interpreter.js');
        console.log('✅ Módulos importados correctamente\n');

        console.log('3️⃣ Probando funciones básicas...');
        console.log('   - generateAnswer:', typeof generateAnswer);
        console.log('   - retrieveImproved:', typeof retrieveImproved);
        console.log('   - interpretPsychologicalTest:', typeof interpretPsychologicalTest);
        console.log('✅ Funciones disponibles\n');

        console.log('🎉 TEST SIMPLE COMPLETADO - Configuración RAG OK');
        console.log('💡 El sistema está listo para interpretar tests psicológicos');

    } catch (error) {
        console.error('❌ ERROR en test simple:', error.message);
        console.error('📍 Ubicación:', error.stack?.split('\n')[1] || 'Desconocida');

        if (error.message.includes('prisma')) {
            console.log('💡 Diagnóstico: Problema de conexión a BD - verificar MySQL');
        } else if (error.message.includes('find module')) {
            console.log('💡 Diagnóstico: Problema de rutas de import');
        } else {
            console.log('💡 Diagnóstico: Error general en configuración');
        }

        throw error;
    }
}

simpleRAGTest().catch(console.error);
