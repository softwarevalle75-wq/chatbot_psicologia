// Test de búsqueda mínima en Qdrant
import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { generateEmbedding } from '../src/RAG/client.js';

async function testBusquedaMinima() {
    console.log('🔍 Test de Búsqueda Mínima en Qdrant');
    console.log('====================================');

    try {
        // Crear cliente
        const client = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });

        // Generar embedding simple
        console.log('🔧 Generando embedding de prueba...');
        const testQuery = "prueba";
        const queryVector = await generateEmbedding(testQuery);
        console.log('✅ Embedding generado, dimensión:', queryVector.length);

        // Intentar búsqueda sin filtros
        console.log('🔎 Intentando búsqueda básica sin filtros...');
        const results = await client.search(process.env.QDRANT_COLECTION, {
            vector: queryVector,
            limit: 1, // Solo 1 resultado para test mínimo
        });

        console.log('✅ Búsqueda básica exitosa!');
        console.log('📊 Resultados encontrados:', results.length);

        // Intentar búsqueda con filtro source
        console.log('🔎 Intentando búsqueda con filtro source...');
        const resultsConFiltro = await client.search(process.env.QDRANT_COLECTION, {
            vector: queryVector,
            limit: 1,
            filter: {
                must: [
                    {
                        key: 'source',
                        match: { value: 'GHQ12' },
                    },
                ],
            },
        });

        console.log('✅ Búsqueda con filtro exitosa!');
        console.log('📊 Resultados con filtro:', resultsConFiltro.length);

        // Mostrar estructura de un resultado
        if (results.length > 0) {
            console.log('📋 Estructura del primer resultado:');
            console.log(JSON.stringify(results[0], null, 2));
        }

    } catch (error) {
        console.log('❌ Error en búsqueda:', error.message);

        // Diagnosticar el error específico
        if (error.message.includes('400')) {
            console.log('🎯 DIAGNÓSTICO: Bad Request - posible problema con:');
            console.log('   - Dimensión del vector');
            console.log('   - Configuración de colección');
            console.log('   - Parámetros de búsqueda');
        } else if (error.message.includes('403')) {
            console.log('🎯 DIAGNÓSTICO: Forbidden - problema de permisos');
        } else if (error.message.includes('404')) {
            console.log('🎯 DIAGNÓSTICO: Not Found - colección no existe');
        }

        console.log('🔍 Detalles completos:', error);
    }
}

testBusquedaMinima();
