// Script para crear índice de payload faltante
import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

async function createPayloadIndex() {
    console.log('🏷️ Creando índice de payload para campo "source"...');

    try {
        const client = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });

        // Verificar que la colección existe
        console.log('🔍 Verificando colección...');
        const collections = await client.getCollections();
        const collectionExists = collections.collections?.some(c => c.name === process.env.QDRANT_COLECTION);

        if (!collectionExists) {
            console.log('❌ La colección no existe, hay que crearla primero');
            return;
        }

        console.log('✅ Colección encontrada');

        // Crear índice para campo 'source'
        console.log('🔧 Creando índice para campo "source"...');
        await client.createPayloadIndex(process.env.QDRANT_COLECTION, {
            field_name: 'source',
            field_schema: {
                type: 'keyword',
                is_indexed: true
            }
        });

        console.log('✅ Índice creado exitosamente!');
        console.log('🎉 Ahora las búsquedas con filtro "source" deberían funcionar');

    } catch (error) {
        console.error('❌ Error creando índice:', error.message);

        if (error.message.includes('already exists')) {
            console.log('ℹ️  El índice ya existe, no hay problema');
        } else {
            console.log('🔍 Puede que necesites resetear la colección completa');
        }
    }
}

createPayloadIndex();
