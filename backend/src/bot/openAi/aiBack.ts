/*  ------------------------ aiBack.js ---------------------------
	Este archivo se encarga de manejar la conexion con OpenAI
    Especificamente es para las respuestas con IA 
	Back se refiere a que se usará para logica interna
    Solicita el historial (para contexto) y la acción a realizar
	--------------------------------------------------------------
*/

import OpenAI from 'openai'

const aiBack = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
})

export async function apiBack(conversationHistory, action) {
	try {
		const hist = conversationHistory.slice(-6)
		hist.push({ role: 'system', content: action }) // Agregar acción al final

		const completion = await aiBack.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: hist,
			temperature: 0,
		})

		const responseBack = completion.choices[0].message.content
		return responseBack
	} catch (error) {
		console.error('Error en la API de OpenAI:', error.message)
		throw new Error('Hubo un problema al obtener la respuesta de la IA.')
	}
}

export async function apiBack1(conversationHistory, action) {
	try {
		const hist = [...conversationHistory]
		hist.push({ role: 'system', content: action }) // Agregar acción al final

		const completion = await aiBack.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: hist,
			temperature: 0,
		})

		const responseBack = completion.choices[0].message.content
		return responseBack
	} catch (error) {
		console.error('Error en la API de OpenAI:', error.message)
		throw new Error('Hubo un problema al obtener la respuesta de la IA.')
	}
}
