import path from 'path'
import { RAGEvaluator } from './rag-evaluator.js'

/**
 * Script principal para ejecutar evaluación completa del RAG
 * Principio: Facade Pattern - interfaz simple para operación compleja
 */

async function main() {
    console.log('🚀 Framework de Evaluación RAG - Psicología')
    console.log('='.repeat(60))
    console.log('Configuración:')
    console.log('   • chunk_size = 255 caracteres')
    console.log('   • chunk_overlap = 60 caracteres') 
    console.log('   • k = 5')
    console.log('   • embeddings = 1536 dimensiones')
    console.log('   • temperature = 0.3')
    console.log('='.repeat(60))

    try {
        // Rutas de archivos
        const evaluationSetPath = path.resolve(process.cwd(), './tests/evaluation_set.json')
        const outputPath = path.resolve(process.cwd(), './test-results')

        // Crear evaluador
        const evaluator = new RAGEvaluator(evaluationSetPath, outputPath)

        // Ejecutar evaluación completa
        await evaluator.runFullEvaluation()

        console.log('\n🎉 Evaluación completada exitosamente')
        console.log('💡 Revisa los resultados en ./test-results/')
        console.log('📈 Usa las métricas para identificar áreas de mejora')

    } catch (error) {
        console.error('\n❌ Error fatal en evaluación:', error.message)
        console.error('🔍 Stack trace:', error.stack)
        process.exit(1)
    }
}

// Manejo de errores global
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
    process.exit(1)
})

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error)
    process.exit(1)
})

// Ejecutar evaluación
main()
