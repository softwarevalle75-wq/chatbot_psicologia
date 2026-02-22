// Script de diagnóstico para verificar API key de OpenAI
import OpenAI from 'openai';
import 'dotenv/config';

async function diagnoseOpenAI() {
    try {
        console.log('🔗 Probando conexión con OpenAI...');

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        console.log('📡 Consultando modelos disponibles...');

        const models = await openai.models.list();

        // Filtrar modelos GPT-4 disponibles
        const gpt4Models = models.data
            .filter(m => m.id.includes('gpt-4'))
            .map(m => m.id)
            .sort();

        console.log('✅ API key válida!');
        console.log('🤖 Modelos GPT-4 disponibles:', gpt4Models);

        // Verificar si gpt-4o-mini está disponible
        if (gpt4Models.includes('gpt-4o-mini')) {
            console.log('✅ gpt-4o-mini está disponible');
        } else {
            console.log('❌ gpt-4o-mini NO está disponible');
            if (gpt4Models.includes('gpt-4o')) {
                console.log('✅ gpt-4o está disponible como alternativa');
            }
        }

        return gpt4Models;

    } catch (error) {
        console.error('❌ Error con API key:', error.message);

        if (error.message.includes('401')) {
            console.log('💡 Diagnóstico: API key inválida o expirada');
        } else if (error.message.includes('403')) {
            console.log('💡 Diagnóstico: API key sin permisos para listar modelos');
        } else if (error.message.includes('429')) {
            console.log('💡 Diagnóstico: Límite de rate alcanzado');
        }

        throw error;
    }
}

// Ejecutar diagnóstico
diagnoseOpenAI().catch(console.error);
