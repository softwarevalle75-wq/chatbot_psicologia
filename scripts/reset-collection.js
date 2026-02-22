import { getQdrantClient, getCollectionName } from '../src/RAG/client.js'

/**
 * Script para resetear colección Qdrant completamente
 * Principio: Nuclear Option - recrear desde cero si hay problemas
 */

async function resetCollection() {
    console.log('🔄 Resetendo colección Qdrant...')
    
    try {
        const client = getQdrantClient()
        const collectionName = getCollectionName()
        
        // 1. Eliminar colección existente
        console.log('🗑️ Eliminando colección existente...')
        try {
            await client.deleteCollection(collectionName)
            console.log('✅ Colección eliminada exitosamente')
        } catch (deleteError) {
            console.warn('⚠️  La colección no existía, continuando...')
        }
        
        // 2. Crear colección nueva con configuración limpia
        console.log('🏗️ Creando colección nueva...')
        await client.createCollection(collectionName, {
            vectors: {
                size: 1536,
                distance: 'Cosine'
            }
        })
        
        console.log('✅ Colección creada exitosamente')
        
        // Crear índices de payload para filtrado eficiente
        console.log('🏷️ Creando índices de payload...')
        try {
            await client.createPayloadIndex(collectionName, {
                field_name: 'source',
                field_schema: {
                    type: 'keyword',
                    is_indexed: true
                }
            })
            console.log('✅ Índice creado para campo "source"')
        } catch (indexError) {
            console.warn('⚠️  Error creando índice (puede que ya exista):', indexError.message)
        }
        
        console.log('📊 Configuración:')
        console.log('   • Vector size: 1536')
        console.log('   • Distance: Cosine')
        console.log('   • Sin filtros complejos')
        
    } catch (error) {
        console.error('❌ Error reseteando colección:', error.message)
        throw error
    }
}

// Ejecutar reset
resetCollection().catch(error => {
    console.error('❌ Error fatal:', error.message)
    process.exit(1)
})
