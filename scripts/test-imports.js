// Script de diagnóstico simple para probar imports
import 'dotenv/config';

console.log('🔧 Probando imports básicos...');

try {
    console.log('📦 Probando import de generator.js...');
    await import('./src/RAG/generator.js');
    console.log('✅ generator.js importado correctamente');

    console.log('📦 Probando import de retriever-improved.js...');
    await import('./src/RAG/retriever-improved.js');
    console.log('✅ retriever-improved.js importado correctamente');

    console.log('📦 Probando import de queries.js...');
    await import('./src/queries/queries.js');
    console.log('✅ queries.js importado correctamente');

    console.log('🎯 Todos los imports básicos funcionan correctamente');

} catch (error) {
    console.error('❌ Error en imports:', error.message);
    console.error('Stack:', error.stack);
}
