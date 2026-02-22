// Test solo OpenAI para medir tokens y costos
import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function testTokensYCosto() {
    console.log('💰 Test de Tokens y Costos - OpenAI GPT-5\n');

    // Query similar a la que usa el RAG
    const query = `Interpretar resultados de prueba psicológica.
Instrumento: GHQ-12
Resultados del paciente: {"0":[],"1":[],"2":[],"3":[1,2,3,4,5,6,7,8,9,10,11,12]}
Analizar según criterios técnicos de los manuales disponibles.
Comparar con baremos, puntos de corte, subescalas y criterios normativos.
Proporcionar interpretación técnica fundamentada.`;

    // Contexto típico de RAG (chunks recuperados)
    const contextChunks = `
Documento: Manual GHQ-12 - Goldberg (1992)
El GHQ-12 es un instrumento de screening para identificar posibles trastornos psiquiátricos menores.
Puntuaciones totales:
- 0-3: Probablemente sin problemas
- 4-6: Posible presencia de trastorno menor
- 7-12: Alta probabilidad de trastorno psiquiátrico

Puntuaciones elevadas indican mayor deterioro psicológico.
Cada pregunta puntúa de 0 a 3, siendo 3 la máxima severidad.

Documento: Baremo GHQ-12 en población española
Punto de corte óptimo: 4/5
Sensibilidad: 82%, Especificidad: 76%
Puntuaciones ≥7 indican casos probables que requieren evaluación especializada.
`.repeat(3); // Simular ~3 chunks típicos

    const prompt = `Actúa como psicólogo clínico especializado en interpretación técnica de pruebas psicológicas.

${contextChunks}

QUERY DEL PACIENTE:
${query}

Proporciona una interpretación técnica fundamentada.`;

    console.log('📊 Datos del test:');
    console.log(`   - Modelo: GPT-5`);
    console.log(`   - Prompt length: ${prompt.length} caracteres`);
    console.log(`   - ~${Math.round(prompt.length / 4)} tokens aproximados`);
    console.log(`   - Max tokens respuesta: 2000\n`);

    try {
        console.log('🚀 Generando respuesta...\n');

        const startTime = Date.now();

        const response = await openai.chat.completions.create({
            model: 'gpt-5',
            messages: [{role: 'user', content: prompt}],
            max_completion_tokens: 2000
            // temperature: 0.2 // GPT-5 solo soporta default (1)
        });

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        const usage = response.usage;
        console.log('✅ Respuesta generada exitosamente!\n');

        console.log('📈 CONSUMO DE TOKENS:');
        console.log(`   - Input tokens: ${usage.prompt_tokens}`);
        console.log(`   - Output tokens: ${usage.completion_tokens}`);
        console.log(`   - Total tokens: ${usage.total_tokens}`);
        console.log(`   - Tiempo: ${duration.toFixed(1)} segundos\n`);

        // Costos aproximados (basado en precios de OpenAI)
        // GPT-4o pricing: $2.50/1M input tokens, $10/1M output tokens
        // GPT-5 usa precios similares o superiores
        const inputCost = (usage.prompt_tokens / 1000000) * 2.50;
        const outputCost = (usage.completion_tokens / 1000000) * 10.00;
        const totalCost = inputCost + outputCost;

        console.log('💸 COSTOS APROXIMADOS (USD):');
        console.log(`   - Input: $${inputCost.toFixed(6)}`);
        console.log(`   - Output: $${outputCost.toFixed(6)}`);
        console.log(`   - TOTAL: $${totalCost.toFixed(6)}`);
        console.log(`   - ~${(totalCost * 1000).toFixed(2)} COP por interpretación\n`);

        console.log('🎯 ANÁLISIS DE COSTO:');
        if (totalCost < 0.01) {
            console.log('   ✅ MUY BARATO - menos de $0.01 USD');
            console.log('   💡 Ideal para uso frecuente en chatbot');
        } else if (totalCost < 0.05) {
            console.log('   ✅ BARATO - menos de $0.05 USD');
            console.log('   💡 Aceptable para interpretaciones complejas');
        } else {
            console.log('   ⚠️  COSTOSO - más de $0.05 USD');
            console.log('   💡 Considerar optimización o modelo más barato');
        }

        console.log('\n🔍 INTERPRETACIÓN GENERADA:');
        console.log('═'.repeat(80));
        console.log(response.choices[0].message.content);
        console.log('═'.repeat(80));

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testTokensYCosto();
