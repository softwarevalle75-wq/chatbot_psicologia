import OpenAI from 'openai'
import {
	prisma,
	obtenerHist,
	saveHist,
	switchAyudaPsicologica,
	switchFlujo,
} from '../../queries/queries.js'
import { promptAgend } from '../../openAi/prompts.js'
import { apiHorarios } from './aiHorarios.js'
import { asignarCita } from './agendController.js'
import { format } from '@formkit/tempo'

//---------------------------------------------------------------------------------------------------------

const aiAgend = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
})

//---------------------------------------------------------------------------------------------------------

// Definición de herramientas
const tools = [
	{
		type: 'function',
		function: {
			name: 'saveDisp',
			description: `
        Esta función procesa los datos del usuario para agendar la cita.
        Debe ser llamada cuando el usuario confirme su disponibilidad.
      `,
			parameters: {
				type: 'object',
				properties: {
					disp: {
						type: 'string',
						description: 'La disponibilidad del usuario',
					},
				},
				required: ['disp'],
				additionalProperties: false,
			},
			strict: true,
		},
	},
]

//---------------------------------------------------------------------------------------------------------

export async function apiAgend(numero, msg) {
	try {
		// Obtener y preparar el historial de conversación
		const conversationHistory = await obtenerHist(numero)
		conversationHistory.unshift({
			role: 'system',
			content: promptAgend,
		})

		// Agregar el mensaje del usuario
		conversationHistory.push({ role: 'user', content: msg })

		// Hacer la llamada a la API
		const response = await aiAgend.chat.completions.create({
			model: 'gpt-5-mini',
			messages: conversationHistory,
			tools: tools,
			tool_choice: 'auto',
		})

		const assistantMessage = response.choices[0].message

		// Manejar las llamadas a funciones si existen
		if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
			for (const toolCall of assistantMessage.tool_calls) {
				if (toolCall.function.name === 'saveDisp') {
					try {
						// Parsear los argumentos
						const args = JSON.parse(toolCall.function.arguments)

						if (args.disp) {
							const dia = await saveDisp(args.disp, numero)
							// Agregar el resultado de la función al historial
							const cita = format(dia.fechaHora, 'dddd, D MMMM HH:mm', 'es')

							conversationHistory.push({
								role: 'assistant',
								content: `Se ha registrado su cita para el día ${cita}`,
							})

							// Guardar el historial actualizado
							conversationHistory.shift() // Remover el prompt del sistema
							await saveHist(numero, conversationHistory)

							return `Se ha registrado su cita para el día ${cita}`
						}
					} catch (error) {
						console.error('Error al procesar los argumentos de la función:', error)
						throw new Error('Error al procesar la disponibilidad')
					}
				}
			}
		} else {
			// Si no hay llamadas a funciones, procesar como mensaje normal
			const messageContent = assistantMessage.content
			conversationHistory.push({ role: 'assistant', content: messageContent })
			conversationHistory.shift() // Remover el prompt del sistema
			await saveHist(numero, conversationHistory)
			return messageContent
		}
	} catch (error) {
		console.error('Error en apiAgend:', error)
		throw new Error('Hubo un error al procesar la solicitud.')
	}
}

//---------------------------------------------------------------------------------------------------------

async function saveDisp(disp, numero) {
	try {
		const horario = await apiHorarios(disp)
		const user = await actualizarDisp(numero, horario)

		await switchAyudaPsicologica(numero, 0)
		await switchFlujo(numero, 'assistantFlow')
		let tempCita = await asignarCita(user)
		console.log(tempCita)
		return tempCita
	} catch (error) {
		console.error('Error al guardar la disponibilidad:', error)
		throw error
	}
}
//---------------------------------------------------------------------------------------------------------
export async function reAgend(disp, numero) {
	try {
		await prisma.informacionUsuario.update({
			where: { telefonoPersonal: numero },
			data: { disponibilidad: {} },
		})
		const horario = await apiHorarios(disp)
		const user = await actualizarDisp(numero, horario)

		await switchAyudaPsicologica(numero, 0)
		await switchFlujo(numero, 'assistantFlow')
		let tempCita = await asignarCita(user)
		console.log(tempCita)
		return tempCita
	} catch (error) {
		console.error('Error al guardar la disponibilidad:', error)
		throw error
	}
}
