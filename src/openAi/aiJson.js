import OpenAI from 'openai'

const aiJson = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
})

export async function apiJson(conversationHistory, action) {
	try {
		const hist = conversationHistory.slice(-4)
		hist.shift() // Eliminar el primer elemento
		hist.push({ role: 'system', content: action }) // Agregar acción al final

		const completion = await aiJson.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: hist,
			response_format: { type: 'json_object' },
		})

		let responseJson = completion.choices[0].message.content
		return responseJson
	} catch (error) {
		console.error('Error en la API de OpenAI:', error.message)
		throw new Error('Hubo un problema al obtener la respuesta de la IA.')
	}
}
