/*  ------------------------ aiBack.js ---------------------------
	Este archivo se encarga de manejar la conexion con OpenAI
    Especificamente es para las respuestas con IA
	Back se refiere a que se usará para logica interna
    Solicita el historial (para contexto) y la acción a realizar
	--------------------------------------------------------------
*/

import OpenAI from 'openai'
import axios from 'axios'
import { obtenerHist, saveHist, switchAyudaPsicologica } from '../../queries/queries.js'
import { assistantPrompt } from '../../openAi/prompts.js'
import { apiBack } from '../../openAi/aiBack.js'

type ConversationMessage = {
	role: 'system' | 'user' | 'assistant'
	content: string
}

type OpenAiTool = {
	type: 'function'
	function: {
		name: string
		description?: string
		parameters?: {
			type: string
			properties: Record<string, unknown>
			required?: string[]
		}
	}
	strict?: boolean
}

//---------------------------------------------------------------------------------------------------------

const aiRegister = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
})

let c = 0

//---------------------------------------------------------------------------------------------------------

async function cambiarEstado(num, hist) {
	const opcion = parseInt(
		await apiBack(
			hist,
			`Devuelve "1" si el usuario no quiere ayuda. De lo contrario, si el usuario SI quiere ayuda devuelve "2"
			IMPORTANTE: SOLO DEVOLVERAS EL NUMERO`
		)
	)
	await switchAyudaPsicologica(num, opcion)
	return {
		success: true,
		result: opcion,
		message: 'Estado del usuario cambiado',
	}
}

//---------------------------------------------------------------------------------------------------------

// Definición de herramientas
const tools: OpenAiTool[] = [
	{
		type: 'function',
		function: {
			name: 'cambiarEstado',
			description: `
            IMPORTANTE: Esta función SOLO debe ser llamada cuando:
            1. El usuario esté interesado en recibir ayuda Psicologia
			2. Si el usuario menciona que quiere una cita de Psicologia
            
            NO llamar esta función:
            - Si el usuario solo está conversando normalmente
            - Si el usuario menciona temas de psicología pero no en respuesta a un ofrecimiento de ayuda
            `,
			parameters: {
				type: 'object',
				properties: {},
			},
		},
	},
]

//---------------------------------------------------------------------------------------------------------

export async function apiAssistant1(numero, msg) {
	const conversationHistory = (await obtenerHist(numero)) as ConversationMessage[]
	conversationHistory.unshift({
		role: 'system',
		content: assistantPrompt,
	})
	if (Math.floor(Math.random() * 10) <= 7) {
		c = c + 1
		console.log('Numero aleatorio')
		console.log(c)
		if (c >= 3) {
			conversationHistory.push({
				role: 'system',
				content: `\nIMPORTANTE:\nDEBES preguntar al usuario si quiere recibir ayuda psicológica. 
					para saber como cambiar el estado del usuario `,
			})
		}
	}

	conversationHistory.push({ role: 'user', content: msg })

	try {
		const response = await aiRegister.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: conversationHistory as any,
			tools: tools as any,
			tool_choice: 'auto', //* Importante usar tool choice
		})

		const assistantMessage = response.choices[0].message.content
		const toolCalls = response.choices[0].message.tool_calls

		if (toolCalls && toolCalls.length > 0) {
			for (const call of toolCalls) {
				if (call.type === 'function' && call.function.name === 'cambiarEstado') {
					await cambiarEstado(numero, conversationHistory)
					await axios.post('http://localhost:3000/v1/messages', {
						number: numero,
						message:
							'Con el fin de brindarte la mejor atención posible, te invitamos a realizar estas dos sencillos Tests. Tu colaboración es muy importante para nosotros. ¿Empezamos?',
					})
					return true
				}
			}
		} else {
			conversationHistory.push({ role: 'assistant', content: assistantMessage })
			conversationHistory.shift()
			await saveHist(numero, conversationHistory)
			return assistantMessage
		}
	} catch (error) {
		console.error('Error al obtener la respuesta de OpenAI:', error)
		throw new Error('Hubo un error al procesar la solicitud.')
	}
}

//---------------------------------------------------------------------------------------------------------

export async function apiAssistant2(numero: string, msg: string) {
	const conversationHistory = (await obtenerHist(numero)) as ConversationMessage[]
	conversationHistory.unshift({ role: 'system', content: assistantPrompt })
	conversationHistory.push({ role: 'user', content: msg })
	try {
		const response = await aiRegister.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: conversationHistory as any,
		})

		const assistantMessage = response.choices[0].message.content

		conversationHistory.push({ role: 'assistant', content: assistantMessage })
		conversationHistory.shift()
		await saveHist(numero, conversationHistory)
		return assistantMessage
	} catch (error) {
		console.error('Error al obtener la respuesta de OpenAI:', error)
		throw new Error('Hubo un error al procesar la solicitud.')
	}
}

//---------------------------------------------------------------------------------------------------------
