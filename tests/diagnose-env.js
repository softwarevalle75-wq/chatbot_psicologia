import 'dotenv/config'
import OpenAI from 'openai'
import { QdrantClient } from '@qdrant/js-client-rest'

/**
 * Script de diagnóstico para variables de entorno y conexiones
 * Principio: Early Validation - detectar problemas antes de ejecutar
 */

async function diagnoseEnvironment() {
    console.log('🔍 Diagnóstico de Entorno RAG')
    console.log('='.repeat(50))

    // 1. Verificar variables de entorno críticas
    console.log('\n📋 1. Variables de Entorno:')
    const requiredVars = [
        'OPENAI_API_KEY',
        'QDRANT_URL', 
        'QDRANT_API_KEY',
        'QDRANT_COLLECTION'
    ]

    let allVarsPresent = true
    for (const varName of requiredVars) {
        const value = process.env[varName]
        const status = value ? '✅' : '❌'
        const display = value ? `${value.substring(0, 10)}...` : 'MISSING'
        
        console.log(`   ${status} ${varName}: ${display}`)
        if (!value) allVarsPresent = false
    }

    if (!allVarsPresent) {
        console.log('\n❌ Faltan variables de entorno críticas')
        console.log('💡 Revisa tu archivo .env')
        return false
    }

    // 2. Probar conexión a OpenAI
    console.log('\n🤖 2. Conexión OpenAI:')
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })

        // Test simple: obtener modelos disponibles
        const models = await openai.models.list()
        console.log('   ✅ Conexión OpenAI exitosa')
        console.log(`   📊 Modelos disponibles: ${models.data.length}`)
        
        // Verificar modelo específico
        const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-large'
        const modelExists = models.data.some(m => m.id === embeddingModel)
        console.log(`   ${modelExists ? '✅' : '❌'} Modelo ${embeddingModel}: ${modelExists ? 'Disponible' : 'No encontrado'}`)

    } catch (error) {
        console.log(`   ❌ Error OpenAI: ${error.message}`)
        if (error.status === 401) {
            console.log('   🔑 Posible causa: API Key inválida')
        } else if (error.status === 429) {
            console.log('   ⏰ Posible causa: Límite de cuota excedido')
        }
        return false
    }

    // 3. Probar conexión a Qdrant
    console.log('\n🗄️ 3. Conexión Qdrant:')
    try {
        const qdrantClient = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        })

        // Test: obtener colecciones
        const collections = await qdrantClient.getCollections()
        console.log('   ✅ Conexión Qdrant exitosa')
        console.log(`   📚 Colecciones disponibles: ${collections.collections.length}`)

        // Verificar colección específica
        const collectionName = process.env.QDRANT_COLLECTION || 'rag-psicologia'
        const collectionExists = collections.collections.some(c => c.name === collectionName)
        console.log(`   ${collectionExists ? '✅' : '❌'} Colección ${collectionName}: ${collectionExists ? 'Existe' : 'No encontrada'}`)

        if (collectionExists) {
            // Obtener info de la colección
            const collectionInfo = await qdrantClient.getCollection(collectionName)
            console.log(`   📊 Vector size: ${collectionInfo.config.params.vectors.size}`)
            console.log(`   📊 Puntos totales: ${collectionInfo.points_count || 0}`)
            
            if ((collectionInfo.points_count || 0) === 0) {
                console.log('   ⚠️  La colección está vacía - ejecuta npm run rag:reindex')
            }
        }

    } catch (error) {
        console.log(`   ❌ Error Qdrant: ${error.message}`)
        if (error.code === 'ECONNREFUSED') {
            console.log('   🔌 Posible causa: Qdrant no está corriendo')
        } else if (error.status === 401) {
            console.log('   🔑 Posible causa: API Key de Qdrant inválida')
        } else if (error.status === 404) {
            console.log('   📁 Posible causa: URL incorrecta o colección no existe')
        }
        return false
    }

    // 4. Verificar configuración de chunking
    console.log('\n🔩 4. Configuración de Chunking:')
    console.log(`   📏 CHUNK_SIZE: 255 caracteres (requerido)`)
    console.log(`   🔄 CHUNK_OVERLAP: 60 caracteres (requerido)`)
    console.log(`   🔢 k: 5 (requerido)`)
    console.log(`   🌡️  temperature: 0.3 (requerido)`)

    // 5. Verificar archivos críticos
    console.log('\n📁 5. Archivos Críticos:')
    const criticalFiles = [
        './src/RAG/generator.js',
        './src/RAG/retriever.js', 
        './src/RAG/client.js',
        './tests/evaluation_set.json'
    ]

    for (const file of criticalFiles) {
        try {
            const fs = await import('fs')
            await fs.promises.access(file)
            console.log(`   ✅ ${file}`)
        } catch (error) {
            console.log(`   ❌ ${file}: No encontrado`)
        }
    }

    console.log('\n✅ Diagnóstico completado')
    console.log('💡 Si todo está en verde, ejecuta: npm run test:quick')
    return true
}

// Ejecutar diagnóstico
diagnoseEnvironment().catch(error => {
    console.error('❌ Error en diagnóstico:', error.message)
    process.exit(1)
})
