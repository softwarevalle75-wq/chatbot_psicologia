/*  ------------------------ aiFront.js ------------------------
	Este archivo se encarga de manejar la conexion con OpenAI
    Especificamente es para las respuestas con IA 
	Front solo se usa para respuestas de Whatsapp
	-----------------------------------------------------------
*/

import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const aiFront = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
})

export async function apiFront(conversationHistory) {
	const completion = await aiFront.chat.completions.create({
		model: 'gpt-4o-mini',
		messages: [...conversationHistory],
		temperature: 0.7,
	})

	const responseFront = completion.choices[0].message.content

	return responseFront
}
