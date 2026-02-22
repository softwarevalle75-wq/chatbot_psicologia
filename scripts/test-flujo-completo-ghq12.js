// Script para probar el flujo completo de GHQ-12 con paciente que responde 3 en todos los items
import 'dotenv/config';
import { procesarGHQ12 } from '../src/flows/tests/ghq12.js';
import { getEstadoCuestionario } from '../src/queries/queries.js';

async function testFlujoCompletoGHQ12() {
    const pacienteId = '573001234567'; // ID de prueba
    const tipoTest = 'ghq12';

    console.log('🧪 Probando flujo completo GHQ-12 con puntuaciones altas...\n');

    try {
        // 1. Iniciar test (primera llamada con null)
        console.log('1️⃣ Iniciando test GHQ-12...');
        let respuesta = await procesarGHQ12(pacienteId, null);
        console.log('📝 Primera pregunta:', respuesta.substring(0, 100) + '...');

        // 2. Responder todas las preguntas con 3 (puntuación máxima)
        console.log('\n2️⃣ Respondiendo todas las preguntas con 3...');
        for (let preguntaNum = 1; preguntaNum <= 12; preguntaNum++) {
            console.log(`   Pregunta ${preguntaNum}/12: Respondiendo 3...`);
            respuesta = await procesarGHQ12(pacienteId, '3');

            // Si es la última pregunta, debería devolver mensaje de completado
            if (preguntaNum === 12) {
                console.log('✅ Test completado! Respuesta final:', respuesta);
            }
        }

        // 3. Verificar estado final en BD
        console.log('\n3️⃣ Verificando estado final en base de datos...');
        const estadoFinal = await getEstadoCuestionario(pacienteId, tipoTest);
        console.log('📊 Estado final:');
        console.log('   - Puntaje 0 (Mejor que habitual):', estadoFinal.resPreg[0]?.length || 0, 'respuestas');
        console.log('   - Puntaje 1 (Igual que habitual):', estadoFinal.resPreg[1]?.length || 0, 'respuestas');
        console.log('   - Puntaje 2 (Menos que habitual):', estadoFinal.resPreg[2]?.length || 0, 'respuestas');
        console.log('   - Puntaje 3 (Mucho menos que habitual):', estadoFinal.resPreg[3]?.length || 0, 'respuestas');

        // 4. Verificar que todos son 3s
        const totalRespuestas = Object.values(estadoFinal.resPreg).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`   - Total respuestas guardadas: ${totalRespuestas}/12`);

        if (estadoFinal.resPreg[3]?.length === 12) {
            console.log('✅ ¡PERFECTO! Todas las respuestas fueron 3 (máxima severidad)');
            console.log('🎉 El RAG debería haber generado una interpretación de alta severidad');
        } else {
            console.log('⚠️  Algo salió mal con las respuestas guardadas');
        }

        console.log('\n🎯 TEST COMPLETADO - Verifica que el practicante recibió la interpretación RAG');

    } catch (error) {
        console.error('❌ Error en test completo:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testFlujoCompletoGHQ12();
