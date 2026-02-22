// Inspeccionar valores reales de source en Qdrant
import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

async function inspeccionarSourceValues() {
    console.log('🔍 Inspeccionando valores de "source" en Qdrant');
    console.log('================================================');

    try {
        const client = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });

        const collectionName = process.env.QDRANT_COLECTION;

        // Obtener una muestra de puntos para ver los valores de source
        console.log('📊 Obteniendo muestra de puntos...');
        const samplePoints = await client.scroll(collectionName, {
            limit: 50, // Más puntos para ver variedad
            with_payload: true,
            with_vector: false
        });

        const valoresSource = new Set();
        const puntosPorSource = {};

        console.log(`📋 Analizando ${samplePoints.points?.length || 0} puntos...`);

        samplePoints.points?.forEach((point, index) => {
            const source = point.payload?.source;
            if (source) {
                valoresSource.add(source);
                puntosPorSource[source] = (puntosPorSource[source] || 0) + 1;

                // Mostrar primeros 10 puntos con detalle
                if (index < 10) {
                    console.log(`   Punto ${index + 1}: source="${source}"`);
                }
            } else {
                console.log(`   Punto ${index + 1}: SIN campo source`);
            }
        });

        console.log('\n📊 RESUMEN:');
        console.log('Valores únicos de source encontrados:', Array.from(valoresSource));
        console.log('Distribución por source:');
        Object.entries(puntosPorSource).forEach(([source, count]) => {
            console.log(`   "${source}": ${count} puntos`);
        });

        const totalConSource = Object.values(puntosPorSource).reduce((sum, count) => sum + count, 0);
        console.log(`\nTotal puntos con campo source: ${totalConSource}`);
        console.log(`Total puntos en muestra: ${samplePoints.points?.length || 0}`);

        // Verificar si existe 'GHQ12'
        if (valoresSource.has('GHQ12')) {
            console.log('\n✅ ¡GHQ12 existe! El filtro debería funcionar');
        } else {
            console.log('\n❌ GHQ12 NO existe en los datos');
            console.log('💡 Valores disponibles:', Array.from(valoresSource));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

inspeccionarSourceValues();
