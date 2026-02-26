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

const rtasDass21 = () => {
    return '0️⃣ No me ha ocurrido.\n    1️⃣ Me ha ocurrido un poco, o durante parte del tiempo.\n    2️⃣ Me ha ocurrido bastante, o durante una buena parte del tiempo.\n    3️⃣ Me ha ocurrido mucho, o la mayor parte del tiempo'
}

//--------------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
let globalProvider = null;

export const configurarProviderDASS21 = (provider) => {
    globalProvider = provider;
    console.log('👍 Provider configurado para envío de PDFs DASS-21')
}

const cuestDass21 = {
    preguntas: [
		'1. Me ha costado mucho descargar la tensión\n    ' + rtasDass21(),


		
		'2. Me di cuenta que tenía la boca seca\n    ' + rtasDass21(),
		'3. No podía sentir ningún sentimiento positivo\n    ' + rtasDass21(),		
		'4. Se me hizo difícil respirar\n    ' + rtasDass21(),			
		'5. Se me hizo difícil tomar la iniciativa para hacer cosas\n    ' + rtasDass21(),
		'6. Reaccioné exageradamente en ciertas situaciones\n    ' + rtasDass21(),
		'7. Sentí que mis manos temblaban\n    ' + rtasDass21(),
		'8. He sentido que estaba gastando una gran cantidad de energía\n    ' + rtasDass21(),
		'9. Estaba preocupado por situaciones en las cuales podía tener pánico o en las que podría hacer el ridículo\n    ' + rtasDass21(),
		'10. He sentido que no había nada que me ilusionara\n    ' + rtasDass21(),
		'11. Me he sentido inquieto\n    ' + rtasDass21(),
		'12. Se me hizo difícil relajarme\n    ' + rtasDass21(),
		'13. Me sentí triste y deprimido\n    ' + rtasDass21(),
		'14. No toleré nada que no me permitiera continuar con lo que estaba haciendo\n    ' + rtasDass21(),
		'15. Sentí que estaba al punto de pánico\n    ' + rtasDass21(),
		'16. No me pude entusiasmar por nada\n    ' + rtasDass21(),
		'17. Sentí que valía muy poco como persona\n    ' + rtasDass21(),
		'18. He tendido a sentirme enfadado con facilidad\n    ' + rtasDass21(),
		'19. Sentí los latidos de mi corazón a pesar de no haber hecho ningún esfuerzo físico\n    ' + rtasDass21(),
		'20. Tuve miedo sin razón\n    ' + rtasDass21(),
		'21. Sentí que la vida no tenía ningún sentido\n    ' + rtasDass21(),	
		],

	resPreg: {
		0: [],
		1: [],
		2: [],
		3: [],			
	}
}

export const procesarDass21 = async (numeroUsuario, respuestas) => {
	const tipoTest = 'dass21'
	const { preguntas } = cuestDass21

	console.log('Procesando DASS-21 para el usuario:', numeroUsuario)

	try {
		let estado = await getEstadoCuestionario(numeroUsuario, tipoTest)
		//console.log('🔍 Estado recuperado de BD:', JSON.stringify(estado, null, 2))

		if (estado.resPreg && ![0,1,2,3].includes(Number(respuestas))) {
			return 'Respuesta inválida. Debe ser un número entre 0 y 3.'
		}

		// permite que el cuestionario inicie desde la pregunta 1
		if (!estado.resPreg || Object.keys(estado.resPreg).length === 0) {
			estado = {
				preguntaActual: 0,
				resPreg: { ...cuestDass21.resPreg },
				respuestas: []
			}
			//console.log('🔍 Estado inicial creado:', JSON.stringify(estado, null, 2))

			await saveEstadoCuestionario(
				numeroUsuario,
				estado.preguntaActual,
				estado.resPreg,
				tipoTest,
				estado.respuestas
			)
			console.log('📝 Iniciando cuestionario, mostrando pregunta 1')
			return preguntas[0]
		}

		// if (respuestas === null) {
		// 	return preguntas[estado.preguntaActual]
		// }

		if (![0,1,2,3].includes(Number(respuestas))) {
			return 'Respuesta inválida. Debe ser un número entre 0 y 3'
		}

		const respuestaNum = Number(respuestas)
		console.log(`Procesando respuesta ${respuestaNum} para pregunta ${estado.preguntaActual + 1}`)

		console.log('🔍 Estado ANTES de agregar respuesta:', JSON.stringify(estado, null, 2))
		if (!estado.resPreg[respuestaNum]) {
			estado.resPreg[respuestaNum] = []
		}
		estado.resPreg[respuestaNum].push(estado.preguntaActual + 1)

		if (!estado.respuestas) {
			console.log('⚠️  ARRAY respuestas NO EXISTE, creándolo...')
			estado.respuestas = []
		}

		estado.respuestas.push(respuestaNum)
		
		console.log(`📊 Respuestas guardadas hasta ahora: [${estado.respuestas.join(', ')}]`)
		console.log(`📊 Total respuestas: ${estado.respuestas.length}/21`)

		//console.log('🔍 Estado DESPUÉS de agregar respuesta:', JSON.stringify(estado, null, 2))

		estado.preguntaActual += 1

		// Verificar si terminamos
		if (estado.preguntaActual >= preguntas.length) {
			console.log('🎉 Cuestionario completado, delegando interpretación al sistema RAG...')	

			// Guardar estado y respuestas crudas (sin scoring hardcodeado)
			await saveEstadoCuestionario(
				numeroUsuario,
				estado.preguntaActual,
				estado.resPreg,
				tipoTest,
				estado.respuestas
			)
			await savePuntajeUsuario(
				numeroUsuario, 
				tipoTest,
				0, // Puntaje crudo, sin calcular
				0,
				0,
				estado.resPreg, 
			)			

			// Se guarda el resultado en la BD (solo respuestas crudas)
			try {
				void generarInformeDASS21Async(numeroUsuario, estado.resPreg)
			} catch (error) {
				console.error('Error procesando resultados DASS-21', error)
			}

			return "✅ *Prueba completada con éxito.*\n\nGracias por completar la evaluación. Los resultados han sido enviados a tu practicante asignado."
		}

		console.log('🔍 Guardando estado en BD:', JSON.stringify(estado, null, 2))

		await saveEstadoCuestionario(
			numeroUsuario,
			estado.preguntaActual,
			estado.resPreg,
			tipoTest,
			estado.respuestas
		)

		console.log(`➡️  Mostrando pregunta ${estado.preguntaActual + 1}`)
		return preguntas[estado.preguntaActual]
		
	} catch (error) {
		console.error('Error al procesar DASS-21:', error)
		return 'Hubo un error al procesar el cuestionario. Por favor, inténtelo de nuevo más tarde.'
	}
}

const generarInformeDASS21Async = async (numeroUsuario, rawResults) => {
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
			'dass21',
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
			testId: 'dass21',
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
				`🧪 *Prueba:* DASS-21\n` +
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
					`🧪 *Prueba:* DASS-21\n` +
					`🕒 *Fecha y hora de elaboración:* ${fechaElaboracion}`,
					pdfPath
				)
				await notificarTestCompletadoAPracticante(numeroUsuario)
			}
		}
	} catch (error) {
		console.error('❌ Error generando/enviando informe DASS-21:', error)
	}
}

export const DASS21info = () => {
	return {
		nombre: 'DASS-21',
		descripcion: 'Escala de Depresión, Ansiedad y Estrés de 21 ítems',
		numPreguntas: cuestDass21.preguntas.length,
		subescalas: ['depresion', 'ansiedad', 'estres'], // Información básica sin lógica de scoring
		tiempoEstimado: '10-15 minutos',
	}
}
