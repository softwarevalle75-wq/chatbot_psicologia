import fs from 'fs'
import crypto from 'crypto'
import { createRequire } from 'module'
import { PdfReader } from 'pdfreader'
import { getQdrantClient, getCollectionName, ensureCollection, generateEmbeddings } from './client.js'
import { getEnabledSources } from './sources.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')
const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 100
const NORMATIVE_CHUNK_SIZE = 700 // Tamaño reducido para secciones normativas (tablas, puntos de corte, baremos)
let GLOBAL_CHUNK_ID = 0 // Contador GLOBAL para todos los documentos
function createHash(text) {
	return crypto.createHash('sha256').update(text).digest('hex') // ← Hash completo de 64 caracteres
}
const parsePDF = async (filePath) => {
	const dataBuffer = fs.readFileSync(filePath)
	const textData = await pdfParse(dataBuffer)
	const cleanedProseText = textData.text
		.split('\n')
		.filter(line => !line.includes('|'))
		.join('\n')
	const rows = {}
	let tablesText = ''
	
	await new Promise((resolve, reject) => {
		new PdfReader().parseBuffer(dataBuffer, (err, item) => {
			if (err) {
				reject(err)
				return
			}
			if (!item) {
				resolve()
				return
			}
			if (item.text) {
				const y = item.y !== undefined ? item.y.toFixed(2) : '0'
				if (!rows[y]) rows[y] = []
				rows[y].push(item.text)
			}
		})
	})
	
	const sortedRows = Object.keys(rows)
		.sort((a, b) => parseFloat(a) - parseFloat(b))
		.map(y => rows[y])
	
	let currentTable = []
	let lastY = null
	for (const row of sortedRows) {
		const y = parseFloat(Object.keys(rows).find(key => rows[key] === row) || '0')
		if (lastY !== null && Math.abs(y - lastY) > 5 && currentTable.length > 0) {
			if (currentTable.length >= 2) {
				const parsedTable = parseIntelligentTable(currentTable)
				if (parsedTable && !parsedTable.includes('[Tabla]')) {
					tablesText += '\n' + parsedTable + '\n'
				}
			}
			currentTable = []
		}
		currentTable.push(row)
		lastY = y
	}
	
	if (currentTable.length >= 2) {
		const parsedTable = parseIntelligentTable(currentTable)
		if (parsedTable && !parsedTable.includes('[Tabla]')) {
			tablesText += '\n' + parsedTable + '\n'
		}
	}
	
	return {
		text: cleanedProseText + (tablesText ? '\n\n---\n\n' + tablesText : ''),
		numPages: textData.numpages,
	}
}

// Función inteligente para parsear tablas
const parseIntelligentTable = (tableRows) => {
	try {
		// Unir todas las celdas de cada fila
		const cleanRows = tableRows.map(row => row.join(' | ').trim())
		
		// Detectar tipo de tabla por patrones
		const tableType = detectTableType(cleanRows)
		
		// Extraer datos según el tipo
		const extractedData = extractTableData(cleanRows, tableType)
		
		// Generar texto legible
		const parsedText = generateTableDescription(extractedData, tableType)
		
		// Si parsing inteligente funcionó, usarlo
		if (parsedText && extractedData.length > 0) {
			return parsedText
		}
		
		// FALLBACK: Si parsing falla, mantener tabla original pero limpiarla un poco
		return cleanTableFallback(cleanRows)
		
	} catch (error) {
		console.warn('Error parseando tabla:', error.message)
		// FALLBACK: Mantener tabla original en caso de error
		return cleanTableFallback(tableRows.map(row => row.join(' | ').trim()))
	}
}

// Fallback para tablas no reconocidas - limpiar pero mantener información
const cleanTableFallback = (rows) => {
	const cleanedRows = rows.map(row => {
		// Limpiar espacios múltiples y caracteres extraños
		let cleaned = row.replace(/\s{2,}/g, ' ') // Reducir múltiples espacios
		cleaned = cleaned.replace(/\|\s*\|\s*\|/g, '| | |') // Arreglar celdas vacías
		cleaned = cleaned.replace(/\s*\|\s*$/g, '') // Eliminar | al final
		cleaned = cleaned.replace(/^\s*\|\s*/g, '') // Eliminar | al inicio
		return cleaned.trim()
	}).filter(row => row.length > 5) // Eliminar filas muy cortas
	
	// Si hay filas válidas, devolver como tabla simple
	if (cleanedRows.length > 0) {
		return '\n[Tabla]\n' + cleanedRows.join('\n')
	}
	
	return null
}

// Detectar tipo de tabla
const detectTableType = (rows) => {
	const text = rows.join(' ').toLowerCase()
	
	// Tabla de coeficientes alfa
	if (text.includes('alpha') || text.includes('α') || text.includes('confiabilidad')) {
		return 'alpha_coefficients'
	}
	
	// Tabla de puntos de corte
	if (text.includes('punto') && text.includes('corte') || text.includes('cut-off')) {
		return 'cut_off_points'
	}
	
	// Tabla de estadísticas descriptivas
	if (text.includes('media') || text.includes('mean') || text.includes('sd') || text.includes('desviación')) {
		return 'descriptive_stats'
	}
	
	// Tabla de correlaciones
	if (text.includes('correlación') || text.includes('correlation') || text.includes('r=')) {
		return 'correlations'
	}
	
	// Tabla de factores (análisis factorial)
	if (text.includes('factor') || text.includes('carga') || text.includes('loading')) {
		return 'factor_analysis'
	}
	
	return null
}

// Extraer datos según tipo de tabla
const extractTableData = (rows, type) => {
	const data = []
	
	for (const row of rows) {
		const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell)
		
		switch (type) {
			case 'alpha_coefficients':
				data.push(extractAlphaData(cells))
				break
			case 'cut_off_points':
				data.push(extractCutOffData(cells))
				break
			case 'descriptive_stats':
				data.push(extractDescriptiveData(cells))
				break
			case 'correlations':
				data.push(extractCorrelationData(cells))
				break
			case 'factor_analysis':
				data.push(extractFactorData(cells))
				break
		}
	}
	
	return data.filter(item => item !== null)
}

// Extraer datos de coeficientes alfa
const extractAlphaData = (cells) => {
	// Buscar patrones como: Sample 1, .88, [.86, .89]
	const sampleMatch = cells.join(' ').match(/sample\s*\d+|undergraduates|general|clinical/i)
	const alphaMatch = cells.join(' ').match(/(\d+\.\d+)/)
	const ciMatch = cells.join(' ').match(/\[(\d+\.\d+),\s*(\d+\.\d+)\]/)
	
	if (sampleMatch && alphaMatch) {
		return {
			sample: sampleMatch[0],
			alpha: parseFloat(alphaMatch[1]),
			ci: ciMatch ? [parseFloat(ciMatch[1]), parseFloat(ciMatch[2])] : null
		}
	}
	
	return null
}

// Extraer datos de puntos de corte
const extractCutOffData = (cells) => {
	const text = cells.join(' ')
	const scoreMatch = text.match(/(\d+\/\d+|\d+)/)
	const sensitivityMatch = text.match(/sensibilidad?\s*[:=]?\s*(\d+\.?\d*)/i)
	const specificityMatch = text.match(/especificidad?\s*[:=]?\s*(\d+\.?\d*)/i)
	
	if (scoreMatch) {
		return {
			cutOff: scoreMatch[1],
			sensitivity: sensitivityMatch ? parseFloat(sensitivityMatch[1]) : null,
			specificity: specificityMatch ? parseFloat(specificityMatch[1]) : null
		}
	}
	
	return null
}

// Extraer datos descriptivos
const extractDescriptiveData = (cells) => {
	const text = cells.join(' ')
	const meanMatch = text.match(/media?\s*[:=]?\s*(\d+\.?\d*)/i)
	const sdMatch = text.match(/sd\s*[:=]?\s*(\d+\.?\d*)/i)
	const nMatch = text.match(/n\s*[:=]?\s*(\d+)/i)
	
	if (meanMatch || sdMatch || nMatch) {
		return {
			mean: meanMatch ? parseFloat(meanMatch[1]) : null,
			sd: sdMatch ? parseFloat(sdMatch[1]) : null,
			n: nMatch ? parseInt(nMatch[1]) : null
		}
	}
	
	return null
}

// Extraer datos de correlaciones
const extractCorrelationData = (cells) => {
	const text = cells.join(' ')
	const rMatch = text.match(/r\s*[:=]?\s*(-?\d+\.?\d*)/i)
	const pMatch = text.match(/p\s*[:=]?\s*(-?\d+\.?\d*)/i)
	
	if (rMatch) {
		return {
			r: parseFloat(rMatch[1]),
			p: pMatch ? parseFloat(pMatch[1]) : null
		}
	}
	
	return null
}

// Extraer datos de factores
const extractFactorData = (cells) => {
	const text = cells.join(' ')
	const itemMatch = text.match(/item\s*(\d+)/i)
	const loadingMatch = text.match(/(\d+\.?\d+)/)
	
	if (itemMatch && loadingMatch) {
		return {
			item: parseInt(itemMatch[1]),
			loading: parseFloat(loadingMatch[1])
		}
	}
	
	return null
}

// Generar descripción legible de la tabla
const generateTableDescription = (data, type) => {
	if (!data || data.length === 0) return null
	
	switch (type) {
		case 'alpha_coefficients':
			return generateAlphaDescription(data)
		case 'cut_off_points':
			return generateCutOffDescription(data)
		case 'descriptive_stats':
			return generateDescriptiveDescription(data)
		case 'correlations':
			return generateCorrelationDescription(data)
		case 'factor_analysis':
			return generateFactorDescription(data)
		default:
			return null
	}
}

const generateAlphaDescription = (data) => {
	const descriptions = data.map(item => {
		let desc = `Coeficiente alfa de ${item.alpha}`
		if (item.sample) desc += ` en ${item.sample}`
		if (item.ci) desc += ` (IC ${item.ci[0]}-${item.ci[1]})`
		return desc
	})
	return `Confiabilidad del instrumento: ${descriptions.join('; ')}.`
}

const generateCutOffDescription = (data) => {
	const descriptions = data.map(item => {
		let desc = `Punto de corte ${item.cutOff}`
		if (item.sensitivity) desc += ` con sensibilidad de ${item.sensitivity}`
		if (item.specificity) desc += ` y especificidad de ${item.specificity}`
		return desc
	})
	return `Puntos de corte recomendados: ${descriptions.join('; ')}.`
}

const generateDescriptiveDescription = (data) => {
	const descriptions = data.map(item => {
		const parts = []
		if (item.mean) parts.push(`media ${item.mean}`)
		if (item.sd) parts.push(`DE ${item.sd}`)
		if (item.n) parts.push(`n=${item.n}`)
		return parts.join(', ')
	})
	return `Estadísticas descriptivas: ${descriptions.join('; ')}.`
}

const generateCorrelationDescription = (data) => {
	const descriptions = data.map(item => {
		let desc = `correlación r=${item.r}`
		if (item.p) desc += ` (p=${item.p})`
		return desc
	})
	return `Correlaciones encontradas: ${descriptions.join('; ')}.`
}

function generateFactorDescription(data) {
	const descriptions = data.map(item => {
		let desc = `ítem ${item.item} carga ${item.loading}`
		return desc
	})
	return `Análisis factorial: ${descriptions.join('; ')}.`
}

// Detecta si un texto contiene contenido normativo
const isNormativeContent = (text) => {
	const normativePatterns = [
		'tabla', 'table', 'punto de corte', 'cut-off', 'baremo', 'norma',
		'coeficiente alfa', 'alpha', 'confiabilidad', 'sensibilidad',
		'especificidad', 'factor', 'carga factorial', 'percentil',
		'media', 'desviación', 'correlación', 'r=', 'p=', 'n=',
		'ítem', 'item', 'subescala', 'factor'
	]
	const lowerText = text.toLowerCase()
	return normativePatterns.some(pattern => lowerText.includes(pattern))
}

// Encuentra el mejor punto de corte sin cortar palabras
const findBestBreakPoint = (text, maxLength) => {
	if (text.length <= maxLength) return text.length

	// 1. Buscar doble salto de línea (\n\n)
	const doubleNewlines = [...text.matchAll(/\n\n/g)]
	for (const match of doubleNewlines) {
		if (match.index < maxLength) {
			const nextCharIndex = match.index + 2
			if (nextCharIndex <= maxLength) return nextCharIndex
		}
	}

	// 2. Buscar salto de línea simple (\n)
	const singleNewlines = [...text.matchAll(/\n/g)]
	for (const match of singleNewlines.reverse()) {
		if (match.index < maxLength - 1) {
			return match.index + 1
		}
	}

	// 3. Buscar punto seguido (.)
	const periods = [...text.matchAll(/\./g)]
	for (const match of periods.reverse()) {
		if (match.index < maxLength - 2) {
			const afterPeriod = text.substring(match.index + 1).trim()
			if (afterPeriod.length > 0 && afterPeriod[0] === afterPeriod[0].toUpperCase()) {
				return match.index + 1
			}
		}
	}

	// 4. Buscar espacio para no cortar palabra
	const spaces = [...text.matchAll(/ /g)]
	for (const match of spaces.reverse()) {
		if (match.index < maxLength - 1) {
			return match.index
		}
	}

	// 5. Último recurso: cortar por longitud
	return maxLength
}

// Crea overlap manteniendo continuidad
const createOverlap = (text, overlapLength) => {
	if (text.length <= overlapLength) return text
	const overlapStart = text.length - overlapLength
	const firstSpace = text.indexOf(' ', overlapStart)
	if (firstSpace !== -1 && firstSpace < text.length) {
		return text.substring(firstSpace + 1)
	}
	return text.substring(overlapStart)
}

// Chunkea una sección individual (no muta GLOBAL_CHUNK_ID)
const chunkSection = (text, metadata, startChunkIndex, startGlobalId) => {
	const chunks = []
	let chunkIndex = startChunkIndex
	let globalChunkCounter = startGlobalId
	let remainingText = text.trim()
	let lastOverlap = ''

	while (remainingText.length > 0) {
		let chunkText = ''

		const chunkSize = isNormativeContent(remainingText.substring(0, 200)) ? NORMATIVE_CHUNK_SIZE : CHUNK_SIZE

		if (lastOverlap) {
			const availableSpace = chunkSize - lastOverlap.length
			if (availableSpace > 50) {
				const breakPoint = findBestBreakPoint(remainingText, availableSpace)
				chunkText = lastOverlap + remainingText.substring(0, breakPoint).trim()
				remainingText = remainingText.substring(breakPoint).trim()
			} else {
				chunkText = lastOverlap
			}
			lastOverlap = ''
		} else {
			const breakPoint = findBestBreakPoint(remainingText, chunkSize)
			chunkText = remainingText.substring(0, breakPoint).trim()
			remainingText = remainingText.substring(breakPoint).trim()
		}

		if (remainingText.length > 0) {
			lastOverlap = createOverlap(chunkText, CHUNK_OVERLAP)
		}

		if (chunkText.length > 10) {
			chunks.push({
				id: globalChunkCounter++,
				vector: null,
				payload: {
					docId: metadata.docId,
					docName: metadata.docName,
					source: metadata.source,
					version: metadata.version,
					chunkIndex,
					pageStart: metadata.pageStart || 1,
					pageEnd: metadata.pageEnd || 1,
					text: chunkText,
					textHash: createHash(chunkText),
					updatedAt: new Date().toISOString(),
				},
			})
			chunkIndex++
		}
	}

	return chunks
}

// Divide el texto en secciones por \n\n---\n\n y chunkea cada una independientemente
const chunkText = (text, metadata) => {
	const sections = text.split('\n\n---\n\n').filter(s => s.trim().length > 0)

	let chunkIndex = 0
	let globalId = GLOBAL_CHUNK_ID
	const allChunks = []

	for (const section of sections) {
		const sectionChunks = chunkSection(section.trim(), metadata, chunkIndex, globalId)
		allChunks.push(...sectionChunks)
		chunkIndex += sectionChunks.length
		globalId += sectionChunks.length
	}

	GLOBAL_CHUNK_ID = globalId
	return allChunks
};

const indexDocument = async (sourceConfig) => {
	const client = getQdrantClient()
	const collectionName = getCollectionName()
	console.log(`📄 Procesando: ${sourceConfig.name}`)
	if (!fs.existsSync(sourceConfig.manualPath)) {
		console.warn(`⚠️  Archivo no encontrado: ${sourceConfig.manualPath}`)
		return { success: false, error: 'File not found' }
	}
	const { text, numPages } = await parsePDF(sourceConfig.manualPath)
	const docId = sourceConfig.docId
	const docName = sourceConfig.docName
	const source = sourceConfig.source
	
	const chunks = chunkText(text, {
		docId,
		docName,
		source,
		version: sourceConfig.version,
		pageStart: 1,
		pageEnd: numPages,
	})
	const texts = chunks.map(c => c.payload.text)
	const embeddings = await generateEmbeddings(texts)
	const points = chunks.map((chunk, i) => ({
		id: chunk.id,
		vector: embeddings[i],
		payload: chunk.payload,
	}))
	await client.upsert(collectionName, {
		wait: true,
		points,
	})
	console.log(`✅ Indexados ${chunks.length} chunks para ${sourceConfig.name}`)
	return { success: true, chunksIndexed: chunks.length }
}
export const initializeRAG = async () => {
	try {
		await ensureCollection()
		const client = getQdrantClient()
		const collectionName = getCollectionName()

		try {
			const countResult = await client.count(collectionName, { exact: true })
			const existingPoints = countResult?.count || 0

			if (existingPoints > 0) {
				console.log(`⏭️  RAG ya indexado (${existingPoints} chunks). Omitiendo reindex al iniciar.`)
				console.log('ℹ️  Usa npm run rag:reindex para forzar reindex.')
				return []
			}
		} catch (countError) {
			console.warn('⚠️ No se pudo consultar el conteo de chunks en Qdrant. Se intentará indexar.', countError?.message || countError)
		}

		const sources = getEnabledSources()
		console.log(`🚀 Inicializando RAG con ${sources.length} fuentes...`)
		const results = []
		for (const source of sources) {
			const result = await indexDocument(source)
			results.push({ source: source.name, ...result })
		}
		console.log('🎉 RAG inicializado correctamente')
		return results
	} catch (error) {
		console.error('❌ Error inicializando RAG:', error)
		throw error
	}
}
export const reindexAll = async () => {
	const client = getQdrantClient()
	const collectionName = getCollectionName()
	try {
		await client.deleteCollection(collectionName)
		console.log(`🗑️  Colección '${collectionName}' eliminada`)
	} catch (e) {
		// Colección no existía, ignorar
	}
	return initializeRAG()
}
