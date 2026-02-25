/**
 * Prueba de calidad de chunks — sin generación LLM.
 * Muestra exactamente qué chunks se recuperan, de qué documento,
 * con qué score y qué contienen.
 */
import { retrieveImproved } from '../src/RAG/retriever.js';
import 'dotenv/config';

// Resultado random de GHQ-12:
// Paciente con 8 ítems positivos (caso probable según método GHQ)
const rawResults = {
    0: [1, 3, 5],        // Mejor que habitual (0 en método GHQ)
    1: [2, 4],           // Igual que habitual  (0 en método GHQ)
    2: [7, 9, 11, 12],   // Menos que habitual  (1 en método GHQ)
    3: [6, 8, 10]        // Mucho menos que habitual (1 en método GHQ)
};

// Puntaje GHQ: ítems con score 1 → categorías 2 y 3 → 4+3 = 7 (caso probable, corte ≥3)
const puntajeGHQ = rawResults[2].length + rawResults[3].length;

console.log('═'.repeat(70));
console.log('🧪 PRUEBA DE CALIDAD DE CHUNKS — GHQ-12');
console.log('═'.repeat(70));
console.log(`\n📊 Datos del paciente (resultado random):`);
console.log(`   Mejor que habitual:      ítems [${rawResults[0]}]`);
console.log(`   Igual que habitual:       ítems [${rawResults[1]}]`);
console.log(`   Menos que habitual:       ítems [${rawResults[2]}]`);
console.log(`   Mucho menos que habitual: ítems [${rawResults[3]}]`);
console.log(`   → Puntaje GHQ (método bimodal): ${puntajeGHQ}/12`);
console.log(`   → Interpretación esperada: CASO PROBABLE (≥3)\n`);

// Queries a probar — una en inglés y una en español para cada aspecto clave
const queriesToTest = [
    { label: 'Puntos de corte [EN]', query: 'GHQ-12 cutoff threshold score sensitivity specificity screening classification' },
    { label: 'Puntos de corte [ES]', query: 'GHQ-12 punto de corte umbral sensibilidad especificidad tamizaje clasificación' },
    { label: 'Reglas de puntuación [EN]', query: 'GHQ-12 scoring method GHQ Likert binary bimodal score calculation' },
    { label: 'Reglas de puntuación [ES]', query: 'GHQ-12 método de puntuación reglas Likert puntuación binaria cálculo' },
];

async function runChunkTest() {
    for (const { label, query } of queriesToTest) {
        console.log('\n' + '─'.repeat(70));
        console.log(`🔍 Query [${label}]:`);
        console.log(`   "${query}"`);
        console.log('─'.repeat(70));

        try {
            const result = await retrieveImproved(query, { k: 5 });

            if (!result.chunks || result.chunks.length === 0) {
                console.log('   ⚠️  Sin resultados');
                continue;
            }

            result.chunks.forEach((chunk, i) => {
                const doc = chunk.docName || chunk.payload?.docName || 'desconocido';
                const page = chunk.pageStart ?? chunk.payload?.pageStart ?? '?';
                const score = (chunk.score ?? 0).toFixed(4);
                const semSim = (chunk.semanticSimilarity ?? 0).toFixed(4);
                const text = (chunk.text || '').trim().substring(0, 200).replace(/\n/g, ' ');

                console.log(`\n   [Chunk ${i + 1}]`);
                console.log(`   📄 Doc:    ${doc}`);
                console.log(`   📃 Página: ${page}`);
                console.log(`   📈 Score Qdrant:    ${score}`);
                console.log(`   📈 Sim. semántica:  ${semSim}`);
                console.log(`   📝 Texto: "${text}..."`);
            });

        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
        }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ Prueba completada');
    console.log('═'.repeat(70));
}

runChunkTest();
