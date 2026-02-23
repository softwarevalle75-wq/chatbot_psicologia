import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const TEST_SOURCES = {
	'GHQ-12-1': {
		manualPath: path.join(__dirname, '../data/manuales/GHQ12/ruiz-et-al.-2017-ghq-12-colombia-1.pdf'),
		docId: 'ruiz-et-al.-2017-ghq-12-colombia-1.pdf',
		docName: 'ruiz-et-al.-2017-ghq-12-colombia-1.pdf',
		source: 'GHQ-12',
		version: 'v1',
		enabled: true,
	},
	'GHQ-12-2': {
		manualPath: path.join(__dirname, '../data/manuales/GHQ12/GHQ12 fiabilidad, validez y estructura factorial..pdf'),
		docId: 'GHQ12 fiabilidad, validez y estructura factorial..pdf',
		docName: 'GHQ12 fiabilidad, validez y estructura factorial..pdf',
		source: 'GHQ-12',
		version: 'v1',
		enabled: true,
	},
	'DASS-21-1': {
		manualPath: path.join(__dirname, '../data/manuales/DASS21/ruiz2017dass21-1.pdf'),
		docId: 'ruiz2017dass21-1.pdf',
		docName: 'ruiz2017dass21-1.pdf',
		source: 'DASS-21',
		version: 'v1',
		enabled: true, // ← ¡ACTIVAR DASS-21!
	},
}
export const getEnabledSources = () => {
	return Object.entries(TEST_SOURCES)
		.filter(([, config]) => config.enabled)
		.map(([name, config]) => ({ name, ...config }))
}