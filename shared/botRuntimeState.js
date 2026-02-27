import fs from 'fs/promises'
import path from 'path'

const RUNTIME_DIR = path.join(process.cwd(), '.runtime')
const STATE_FILE = path.join(RUNTIME_DIR, 'bot-state.json')

const ensureDigitsPhone = (value) => String(value || '').replace(/\D/g, '')

export const saveBotRuntimePhone = async (phone, source = 'unknown') => {
	const cleanPhone = ensureDigitsPhone(phone)
	if (!cleanPhone) return null

	const payload = {
		phone: cleanPhone,
		source,
		updatedAt: new Date().toISOString(),
	}

	await fs.mkdir(RUNTIME_DIR, { recursive: true })
	await fs.writeFile(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8')
	return payload
}

export const readBotRuntimePhone = async () => {
	try {
		const raw = await fs.readFile(STATE_FILE, 'utf8')
		const data = JSON.parse(raw)
		const phone = ensureDigitsPhone(data?.phone)
		if (!phone) return null
		return {
			phone,
			source: data?.source || 'runtime',
			updatedAt: data?.updatedAt || null,
		}
	} catch {
		return null
	}
}
