// Script para inicializar configuración RAG unificada para tests psicológicos
import { initializeRagPsychologicalConfig } from '../src/queries/queries.js';

const SYSTEM_INSTRUCTIONS = `Actua como psicologo clinico y psicometrista. Interpreta pruebas usando solo el contexto normativo recibido y los resultados del paciente. No uses conocimiento externo. No pidas datos adicionales si ya estan en el prompt. No emitas diagnosticos definitivos: solo hipotesis tentativas con nivel de probabilidad y sustento. Responde en Markdown, lenguaje tecnico y prudente.`;

const PROMPT_TEMPLATE = `Genera un informe tecnico siguiendo EXACTAMENTE esta estructura y numeracion:

Informe de Interpretacion Tecnica
{question}

⚠️ Aclaracion metodologica
Las agrupaciones presentadas se utilizan exclusivamente con fines descriptivos e interpretativos. El GHQ-12 evalua un constructo unidimensional de malestar psicologico general y no constituye un instrumento diagnostico ni mide subescalas diagnosticas independientes.

1. Identificacion del instrumento
2. Datos del paciente
3. Resultados obtenidos
4. Clasificacion normativa completa
5. Comparacion explicita con criterios del manual
6. Analisis descriptivo por agrupaciones (si aplica)
7. Evaluacion de coherencia interna del perfil
8. Perfil psicologico probable
9. Hipotesis diagnostica tentativa
10. Recomendaciones tecnicas
11. Limitaciones del analisis
12. Advertencia etica obligatoria (Ley 1090 de 2006)

Reglas obligatorias:
- Contrasta cada conclusion con el contexto normativo.
- Incluye puntaje por item usando la seccion "Puntaje por item".
- Incluye datos del paciente usando la seccion "Datos del paciente".
- Si faltan datos clinicos (nombre, edad, sexo, etc.), escribe "No disponible" sin detener el informe.
- No pidas informacion adicional.
- Si {question} = GHQ-12, incluye agrupaciones descriptivas:
  - Estado de animo depresivo: items 9 y 12
  - Autoestima: items 10 y 11
  - Afrontamiento: items 6 y 8
  - Ansiedad/tension: items 2 y 5
  - Funcionamiento cognitivo: items 1 y 4
  - Funcionamiento psicosocial: items 3 y 7
- Si hay elevaciones clinicamente relevantes en GHQ-12, recomienda DASS-21 complementario.

Datos del paciente:
{patientData}

Resultados del paciente:
{rawResults}

Puntaje por item:
{itemScores}

Contexto normativo:
{context}`;

const METADATA = {
    version: '1.1',
    supported_tests: ['ghq12', 'dass21'],
    descripcion: 'Sistema unificado de prompts para interpretación de tests psicológicos',
    fecha_creacion: new Date().toISOString(),
    autor: 'Sistema RAG Unificado'
};

async function initializeConfig() {
    try {
        console.log('🚀 Inicializando configuración RAG unificada...');

        const config = await initializeRagPsychologicalConfig(
            SYSTEM_INSTRUCTIONS,
            PROMPT_TEMPLATE,
            METADATA
        );

        console.log('✅ Configuración RAG inicializada exitosamente');
        console.log('📋 Detalles:', {
            id: config.id,
            version: config.version,
            createdAt: config.createdAt
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error inicializando configuración:', error);
        process.exit(1);
    }
}

initializeConfig();
