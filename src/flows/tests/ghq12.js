import {
	getEstadoCuestionario,
	saveEstadoCuestionario,
	savePuntajeUsuario,
	obtenerTelefonoPracticante,
	obtenerPerfilPacienteParaInforme,
	sendAutonomousMessage,
	sendAutonomousDocument,
	notificarTestCompletadoAPracticante,
} from '../../queries/queries.js'

import { interpretPsychologicalTest } from '../../RAG/psychological-interpreter.js'
import { generateInterpretationPdf } from './reportPdf.js'

const cuestGhq12 = {    
    preguntas: [
        '1. ¿Ha podido concentrarse bien en lo que hace?\n    0️⃣ Mejor que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos que lo habitual.\n    3️⃣ Mucho menos que lo habitual.',
        '2. ¿Sus preocupaciones le han hecho perder mucho el sueño?\n    0️⃣ No, en absoluto.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',
        '3. ¿Ha sentido que está desempeñando un papel útil en la vida?\n    0️⃣ Más que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos que lo habitual.\n    3️⃣ Mucho menos que lo habitual.',        
        // '4. ¿Se ha sentido capaz de tomar decisiones?\n    0️⃣ Más capaz que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos capaz que lo habitual.\n    3️⃣ Mucho menos capaz que lo habitual.',
        // '5. ¿Se ha sentido constantemente agobiado y en tensión?\n    0️⃣ No, en absoluto.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',        
        // '6. ¿Ha sentido que no puede superar sus dificultades?\n    0️⃣ No, en absoluto.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',
        // '7. ¿Ha sido capaz de disfrutar de sus actividades normales de cada día?\n    0️⃣ Más que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos que lo habitual.\n    3️⃣ Mucho menos que lo habitual.',
        // '8. ¿Ha sido capaz de hacer frente adecuadamente a sus problemas?\n    0️⃣ Más capaz que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos capaz que lo habitual.\n    3️⃣ Mucho menos capaz que lo habitual.',
        // '9. ¿Se ha sentido poco feliz o deprimido/a?\n    0️⃣ No, en absoluto.\n    1️⃣ No más que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',
        // '10. ¿Ha perdido confianza en sí mismo/a?\n    0️⃣ No, en absoluto.\n    1️⃣ No más que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',
        // '11. ¿Ha pensado que usted es una persona que no vale para nada?\n    0️⃣ No, en absoluto.\n    1️⃣ No más que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',
        // '12. ¿Se siente razonablemente feliz considerando todas las circunstancias?\n    0️⃣ Más feliz que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos feliz que lo habitual.\n    3️⃣ Mucho menos feliz que lo habitual.',
    ],
    resPreg: {
        0: [],
        1: [],
        2: [],
        3: [],
    },
}

//--------------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
let globalProvider = null;

export const configurarProviderGHQ12 = (provider) => {
    globalProvider = provider;
    console.log('👍 Provider configurado para envío de PDFs')
}

export const procesarGHQ12 = async (numeroUsuario, respuestas) => {
    const tipoTest = 'ghq12'
    const { preguntas } = cuestGhq12

    console.log('Procesando GHQ-12 para el usuario:', numeroUsuario)

    try {
        let estado = await getEstadoCuestionario(numeroUsuario, tipoTest)

        // Validar respuesta
        if (estado.resPreg && ![0,1,2,3].includes(Number(respuestas))) {
            return {
                error: 'Respuesta inválida. Debe ser un número entre 0 y 3.',
            }
        }

        // permite que el cuestionario inicie desde la pregunta 1
        if (!estado.resPreg || Object.keys(estado.resPreg).length === 0) {
            estado = {
                Puntaje: 0,
                preguntaActual: 0,
                resPreg: { ...cuestGhq12.resPreg }, 
            }
            await saveEstadoCuestionario(
                numeroUsuario,
                estado.preguntaActual,
                estado.resPreg,
                tipoTest,
                estado.Puntaje,
            )
            return preguntas[0]
        }

        if (respuestas === null) {
			return preguntas[estado.preguntaActual]
		}

        const respuestaNum = Number(respuestas)

        // Guardar respuesta (sin scoring hardcodeado)
        if (!estado.resPreg[respuestaNum]) {
            estado.resPreg[respuestaNum] = []
        }
        estado.resPreg[respuestaNum].push(estado.preguntaActual + 1)

        // Verificar si hay más preguntas
        const siguientePregunta = estado.preguntaActual + 1 
        if (siguientePregunta >= preguntas.length) {
            
            // Guardar estado y respuestas crudas (sin puntaje calculado)
            await saveEstadoCuestionario(
                numeroUsuario,
                estado.preguntaActual,
                estado.resPreg,
                tipoTest,
                estado.Puntaje,
            )
            await savePuntajeUsuario(numeroUsuario, tipoTest, estado.Puntaje, estado.resPreg )

            void generarInformeGHQ12Async(numeroUsuario, estado.resPreg)

            return "✅ *Prueba completada con éxito.*\n\nGracias por completar la evaluación. Los resultados han sido enviados a tu practicante asignado."
        }

        // Siguiente pregunta
        estado.preguntaActual = siguientePregunta
        await saveEstadoCuestionario(
            numeroUsuario,
            estado.preguntaActual,
            estado.resPreg,
            tipoTest,
            estado.Puntaje,
        )

        return preguntas[estado.preguntaActual]

    } catch (error) {
        console.error('Error al procesar GHQ-12:', error)
        return 'Hubo un error al procesar la prueba. Por favor, inténtelo de nuevo más tarde.'

    }
}

const generarInformeGHQ12Async = async (numeroUsuario, rawResults) => {
    try {
        const pdfTarget = (process.env.PDF_TARGET || 'practitioner').toLowerCase()
        const sendPdfToPatient = pdfTarget === 'patient' || pdfTarget === 'both'
        const sendPdfToPractitioner = pdfTarget === 'practitioner' || pdfTarget === 'both'

        let telefonoPracticante = null
        if (sendPdfToPractitioner) {
            telefonoPracticante = await obtenerTelefonoPracticante(numeroUsuario)
            if (telefonoPracticante) {
                await sendAutonomousMessage(
                    telefonoPracticante,
                    '⏳ *Generando informe técnico...*\n\nEn breve recibirás el PDF con la interpretación.'
                )
            }
        }

        const resultadoInterpretacion = await interpretPsychologicalTest(
            'ghq12',
            rawResults,
            numeroUsuario
        )

        const fechaElaboracion = new Date().toLocaleString('es-CO')
        const patientData = await obtenerPerfilPacienteParaInforme(numeroUsuario)
        const nombrePaciente = [patientData?.nombres, patientData?.apellidos].filter(Boolean).join(' ').trim() || 'No disponible'
        const documentoPaciente = patientData?.documento && patientData.documento !== 'No disponible'
            ? `${patientData?.tipoDocumento || 'Doc'} ${patientData.documento}`
            : 'No disponible'
        const edadPaciente = patientData?.edad || 'No disponible'
        const telefonoPaciente = patientData?.telefonoPrincipal || numeroUsuario

        const pdfPath = await generateInterpretationPdf({
            numeroUsuario,
            testId: 'ghq12',
            interpretation: resultadoInterpretacion.interpretation,
            metadata: resultadoInterpretacion.metadata,
            rawResults,
            patientData,
        })

        if (sendPdfToPatient) {
            await sendAutonomousDocument(
                numeroUsuario,
                `📄 *Informe técnico generado*\n\n` +
                `👤 *Paciente:* ${nombrePaciente}\n` +
                `🪪 *Documento:* ${documentoPaciente}\n` +
                `🎂 *Edad:* ${edadPaciente}\n` +
                `📱 *Teléfono:* ${telefonoPaciente}\n` +
                `🧪 *Prueba:* GHQ-12\n` +
                `🕒 *Fecha y hora de elaboración:* ${fechaElaboracion}`,
                pdfPath
            )
        }

        if (sendPdfToPractitioner) {
            if (!telefonoPracticante) {
                console.warn(`⚠️ PDF_TARGET=${pdfTarget} pero no hay practicante asignado para ${numeroUsuario}; no se envía PDF.`)
            } else {
                await sendAutonomousDocument(
                    telefonoPracticante,
                    `📄 *Informe técnico disponible*\n\n` +
                    `👤 *Paciente:* ${nombrePaciente}\n` +
                    `🪪 *Documento:* ${documentoPaciente}\n` +
                    `🎂 *Edad:* ${edadPaciente}\n` +
                    `📱 *Teléfono:* ${telefonoPaciente}\n` +
                    `🧪 *Prueba:* GHQ-12\n` +
                    `🕒 *Fecha y hora de elaboración:* ${fechaElaboracion}`,
                    pdfPath
                )
                await notificarTestCompletadoAPracticante(numeroUsuario)
            }
        }
    } catch (error) {
        console.error('❌ Error generando/enviando informe GHQ-12:', error)
    }
}

export const GHQ12info = () => {
    return {
        nombre: 'GHQ-12',
        descripcion: 'Cuestionario de Salud General de 12 ítems',
        numPreguntas: cuestGhq12.preguntas.length,
        tiempoEstimado: '5-10 minutos',
    }
}



