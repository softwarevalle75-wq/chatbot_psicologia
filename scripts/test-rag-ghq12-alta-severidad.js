// Test directo del RAG con datos de paciente que respondió 3 en todos los items del GHQ-12
import 'dotenv/config';
import { interpretPsychologicalTest } from '../src/RAG/psychological-interpreter.js';

async function testRAGConDatosAltosGHQ12() {
    const pacienteId = '573001234567';
    const tipoTest = 'ghq12';

    // Simular respuestas de paciente con máxima severidad (3 en todas las preguntas)
    const respuestasPaciente = {
        0: [], // Mejor que habitual: ninguna
        1: [], // Igual que habitual: ninguna
        2: [], // Menos que habitual: ninguna
        3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] // Mucho menos que habitual: TODAS las preguntas
    };

    console.log('🧪 Probando RAG con paciente GHQ-12 de alta severidad...\n');

    console.log('📊 Datos del paciente:');
    console.log('   - Puntaje 0 (Mejor que habitual):', respuestasPaciente[0].length, 'respuestas');
    console.log('   - Puntaje 1 (Igual que habitual):', respuestasPaciente[1].length, 'respuestas');
    console.log('   - Puntaje 2 (Menos que habitual):', respuestasPaciente[2].length, 'respuestas');
    console.log('   - Puntaje 3 (Mucho menos que habitual):', respuestasPaciente[3].length, 'respuestas');
    console.log('   - Total respuestas:', Object.values(respuestasPaciente).reduce((sum, arr) => sum + arr.length, 0));

    console.log('\n🤖 Generando interpretación RAG...\n');

    try {
        const resultado = await interpretPsychologicalTest(tipoTest, respuestasPaciente, pacienteId);

        console.log('✅ Interpretación generada exitosamente!');
        console.log('📝 Longitud de la interpretación:', resultado.interpretation.length, 'caracteres');
        console.log('\n📋 METADATA:');
        console.log('   - Test ID:', resultado.metadata.test_id);
        console.log('   - Documentos consultados:', resultado.metadata.documentos_consultados?.length || 0);
        console.log('   - Chunks utilizados:', resultado.metadata.chunks_utilizados);
        console.log('   - Prompt version:', resultado.metadata.prompt_version);

        console.log('\n🔍 INTERPRETACIÓN GENERADA:');
        console.log('═'.repeat(80));
        console.log(resultado.interpretation);
        console.log('═'.repeat(80));

        // Verificar que la interpretación menciona alta severidad
        const interpretacionLower = resultado.interpretation.toLowerCase();
        if (interpretacionLower.includes('sever') || interpretacionLower.includes('alto') ||
            interpretacionLower.includes('significativ') || interpretacionLower.includes('preocupante')) {
            console.log('\n✅ ¡EXCELENTE! La interpretación detecta correctamente la alta severidad');
        } else {
            console.log('\n⚠️  La interpretación podría no estar detectando la severidad correctamente');
        }

    } catch (error) {
        console.error('❌ Error en interpretación RAG:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testRAGConDatosAltosGHQ12();
