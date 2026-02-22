// Test mínimo para verificar conectividad Qdrant
import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

async function testQdrantConnectivity() {
    console.log('🔍 Test de Conectividad Qdrant Mínimo');
    console.log('=====================================');

    // 1. Verificar variables de entorno
    console.log('📋 Variables de entorno:');
    console.log('   URL:', process.env.QDRANT_URL ? '✅ Definida' : '❌ Undefined');
    console.log('   API Key:', process.env.QDRANT_API_KEY ? `✅ ${process.env.QDRANT_API_KEY.length} chars` : '❌ Undefined');
    console.log('   Collection:', process.env.QDRANT_COLECTION ? '✅ Definida' : '❌ Undefined');
    console.log('');

    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY || !process.env.QDRANT_COLECTION) {
        console.log('❌ Variables de entorno faltantes');
        return;
    }

    try {
        // 2. Crear cliente
        console.log('🔧 Creando cliente Qdrant...');
        const client = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });
        console.log('✅ Cliente creado');
        console.log('');

        // 3. Intentar ping básico
        console.log('🏓 Intentando conexión básica...');
        const collections = await client.getCollections();
        console.log('✅ Conexión exitosa!');
        console.log('📊 Colecciones disponibles:', collections.collections?.length || 0);
        console.log('');

        // 4. Verificar colección específica
        console.log('🔍 Verificando colección específica...');
        const collectionInfo = await client.getCollection(process.env.QDRANT_COLECTION);
        console.log('✅ Colección encontrada!');
        console.log('   Nombre:', collectionInfo.result?.name);
        console.log('   Vectores:', collectionInfo.result?.vectors_count || 0);
        console.log('   Config:', JSON.stringify(collectionInfo.result?.config?.params?.vectors, null, 2));

    } catch (error) {
        console.log('❌ Error de conectividad:', error.message);
        console.log('🔍 Detalles del error:', error);

        // Diagnosticar tipo de error
        if (error.message.includes('fetch')) {
            console.log('🎯 DIAGNÓSTICO: Problema de red/conectividad');
        } else if (error.message.includes('401') || error.message.includes('403')) {
            console.log('🎯 DIAGNÓSTICO: Problema de autenticación (API key)');
        } else if (error.message.includes('404')) {
            console.log('🎯 DIAGNÓSTICO: Colección no encontrada');
        } else {
            console.log('🎯 DIAGNÓSTICO: Error desconocido');
        }
    }
}

testQdrantConnectivity();
