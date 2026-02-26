import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

const COLORS = {
	primary: '#1F4E79',
	secondary: '#EEF4FB',
	text: '#1F2937',
	muted: '#6B7280',
	border: '#D1D5DB',
}

const ensureTempDir = () => {
	const tempDir = path.resolve(process.cwd(), 'temp')
	if (!fs.existsSync(tempDir)) {
		fs.mkdirSync(tempDir, { recursive: true })
	}
	return tempDir
}

const sanitizePdfText = (value) => {
	if (value === undefined || value === null) return ''
	const normalized = String(value)
		.normalize('NFKC')
		.replace(/\r\n/g, '\n')
		.replace(/[\u2012\u2013\u2014\u2212]/g, '-')

	return Array.from(normalized)
		.filter((char) => {
			const code = char.charCodeAt(0)
			const isAllowedWhitespace = code === 9 || code === 10 || code === 13
			const isAsciiPrintable = code >= 32 && code <= 126
			const isLatin1Printable = code >= 160 && code <= 255
			return isAllowedWhitespace || isAsciiPrintable || isLatin1Printable
		})
		.join('')
}

const normalizeInterpretation = (text) => {
	const sanitized = sanitizePdfText(text)
	const lines = sanitized.split('\n')
	const transformed = []

	for (const rawLine of lines) {
		const line = rawLine.trim()
		if (!line) {
			transformed.push('')
			continue
		}

		if (/^\|?\s*-{2,}/.test(line) || /^\|[-\s|:]+\|$/.test(line)) {
			continue
		}

		if (line.includes('|')) {
			const cells = line
				.split('|')
				.map((cell) => cell.trim())
				.filter(Boolean)

			if (cells.length >= 2) {
				if (/^item$/i.test(cells[0])) {
					continue
				}
				if (cells.length === 2) transformed.push(`- ${cells[0]}: ${cells[1]}`)
				if (cells.length >= 3) transformed.push(`- ${cells[0]}: ${cells[1]} (${cells[2]})`)
				continue
			}
		}

		transformed.push(rawLine)
	}

	return transformed.join('\n')
}

const stripMarkdownInline = (text) => {
	return sanitizePdfText(text)
		.replace(/\*\*(.*?)\*\*/g, '$1')
		.replace(/\*(.*?)\*/g, '$1')
}

const drawInterpretationContent = (doc, interpretationText) => {
	const lines = normalizeInterpretation(interpretationText)
		.split('\n')
		.map((line) => line.replace(/\t/g, '    '))

	const left = doc.page.margins.left
	const width = doc.page.width - doc.page.margins.left - doc.page.margins.right

	for (const rawLine of lines) {
		const line = rawLine.trim()

		if (!line) {
			doc.moveDown(0.45)
			continue
		}

		ensureSpace(doc, 28)

		if (/^#{1,3}\s+/.test(line)) {
			const title = line.replace(/^#{1,3}\s+/, '')
			doc.moveDown(0.25)
			doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary)
			doc.text(stripMarkdownInline(title), left, doc.y, { width, align: 'left', lineGap: 1 })
			doc.moveDown(0.2)
			continue
		}

		if (/^\d+[.)]\s+/.test(line)) {
			doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary)
			doc.text(stripMarkdownInline(line), left, doc.y, { width, align: 'left', lineGap: 1 })
			doc.moveDown(0.15)
			continue
		}

		if (/^[-*]\s+/.test(line)) {
			const bulletText = line.replace(/^[-*]\s+/, '')
			doc.font('Helvetica').fontSize(10).fillColor(COLORS.text)
			doc.text(`• ${stripMarkdownInline(bulletText)}`, left, doc.y, { width, align: 'left', lineGap: 1 })
			doc.moveDown(0.05)
			continue
		}

		doc.font('Helvetica').fontSize(10).fillColor(COLORS.text)
		doc.text(stripMarkdownInline(line), left, doc.y, { width, align: 'left', lineGap: 1 })
		doc.moveDown(0.05)
	}
}

const itemRowsFromRawResults = (rawResults, testId) => {
	const rows = []
	for (const score of [0, 1, 2, 3]) {
		const items = Array.isArray(rawResults?.[score]) ? rawResults[score] : []
		for (const item of items) {
			const itemNumber = Number(item)
			rows.push({
				item: itemNumber,
				score,
				etiqueta: responseLabel(testId, itemNumber, score),
			})
		}
	}
	return rows
		.filter((r) => Number.isFinite(r.item))
		.sort((a, b) => a.item - b.item)
}

const GHQ12_ITEM_LABELS = {
	1: ['Mejor que lo habitual', 'Igual que lo habitual', 'Menos que lo habitual', 'Mucho menos que lo habitual'],
	2: ['No, en absoluto', 'Igual que lo habitual', 'Mas que lo habitual', 'Mucho mas que lo habitual'],
	3: ['Mas que lo habitual', 'Igual que lo habitual', 'Menos que lo habitual', 'Mucho menos que lo habitual'],
	4: ['Mas capaz que lo habitual', 'Igual que lo habitual', 'Menos capaz que lo habitual', 'Mucho menos capaz que lo habitual'],
	5: ['No, en absoluto', 'Igual que lo habitual', 'Mas que lo habitual', 'Mucho mas que lo habitual'],
	6: ['No, en absoluto', 'Igual que lo habitual', 'Mas que lo habitual', 'Mucho mas que lo habitual'],
	7: ['Mas que lo habitual', 'Igual que lo habitual', 'Menos que lo habitual', 'Mucho menos que lo habitual'],
	8: ['Mas capaz que lo habitual', 'Igual que lo habitual', 'Menos capaz que lo habitual', 'Mucho menos capaz que lo habitual'],
	9: ['No, en absoluto', 'No mas que lo habitual', 'Mas que lo habitual', 'Mucho mas que lo habitual'],
	10: ['No, en absoluto', 'No mas que lo habitual', 'Mas que lo habitual', 'Mucho mas que lo habitual'],
	11: ['No, en absoluto', 'No mas que lo habitual', 'Mas que lo habitual', 'Mucho mas que lo habitual'],
	12: ['Mas feliz que lo habitual', 'Igual que lo habitual', 'Menos feliz que lo habitual', 'Mucho menos feliz que lo habitual'],
}

const responseLabel = (testId, item, score) => {
	const isDass = String(testId || '').toLowerCase() === 'dass21'
	if (isDass) {
		return [
			'No me ha ocurrido',
			'Me ha ocurrido un poco',
			'Me ha ocurrido bastante',
			'Me ha ocurrido mucho',
		][score] || 'No disponible'
	}

	const ghqLabels = GHQ12_ITEM_LABELS[item]
	if (ghqLabels) {
		return ghqLabels[score] || 'No disponible'
	}

	return [
		'Mejor que lo habitual',
		'Igual que lo habitual',
		'Menos que lo habitual',
		'Mucho menos que lo habitual',
	][score] || 'No disponible'
}

const drawHeader = (doc, title, subtitle) => {
	const { left, right } = doc.page.margins
	const width = doc.page.width - left - right
	const y = doc.y

	doc.save()
	doc.roundedRect(left, y, width, 88, 8).fill(COLORS.primary)
	doc.restore()

	doc.fillColor('white').font('Helvetica-Bold').fontSize(18)
	doc.text(sanitizePdfText(title), left + 16, y + 16, { width: width - 32, align: 'left' })

	doc.font('Helvetica').fontSize(11)
	doc.text(sanitizePdfText(subtitle), left + 16, y + 48, { width: width - 32, align: 'left' })

	doc.fillColor(COLORS.text)
	doc.y = y + 104
}

const ensureSpace = (doc, minHeight = 80) => {
	if (doc.y + minHeight > doc.page.height - doc.page.margins.bottom) {
		doc.addPage()
	}
}

const drawSectionTitle = (doc, title) => {
	ensureSpace(doc, 36)
	doc.moveDown(0.4)
	doc.x = doc.page.margins.left
	doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(13)
	doc.text(sanitizePdfText(title), doc.page.margins.left, doc.y, { align: 'left' })
	doc.moveTo(doc.page.margins.left, doc.y + 2)
		.lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
		.strokeColor(COLORS.border)
		.stroke()
	doc.moveDown(0.6)
	doc.x = doc.page.margins.left
	doc.fillColor(COLORS.text)
}

const drawKeyValueGrid = (doc, rows) => {
	const left = doc.page.margins.left
	const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
	const colWidth = (contentWidth - 14) / 2
	const rowHeight = 44

	for (let i = 0; i < rows.length; i += 2) {
		ensureSpace(doc, rowHeight + 10)
		const y = doc.y
		const pair = [rows[i], rows[i + 1]].filter(Boolean)

		pair.forEach((entry, idx) => {
			const x = left + idx * (colWidth + 14)
			doc.save()
			doc.roundedRect(x, y, colWidth, rowHeight, 6).fill(COLORS.secondary)
			doc.restore()

			doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(9)
			doc.text(sanitizePdfText(entry.label), x + 10, y + 8, { width: colWidth - 20 })
			doc.fillColor(COLORS.text).font('Helvetica').fontSize(10)
			doc.text(sanitizePdfText(entry.value || 'No disponible'), x + 10, y + 22, { width: colWidth - 20 })
		})

		doc.y = y + rowHeight + 8
	}
}

const drawItemsTable = (doc, rows) => {
	const left = doc.page.margins.left
	const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
	const widths = [70, 70, contentWidth - 140]
	const rowHeight = 20

	const drawHeaderRow = () => {
		ensureSpace(doc, rowHeight + 10)
		const y = doc.y
		doc.save()
		doc.rect(left, y, contentWidth, rowHeight).fill(COLORS.primary)
		doc.restore()

		doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
		doc.text('Item', left + 8, y + 6, { width: widths[0] - 12 })
		doc.text('Puntaje', left + widths[0] + 8, y + 6, { width: widths[1] - 12 })
		doc.text('Respuesta registrada', left + widths[0] + widths[1] + 8, y + 6, { width: widths[2] - 12 })
		doc.fillColor(COLORS.text)
		doc.y = y + rowHeight
	}

	drawHeaderRow()

	rows.forEach((row, idx) => {
		ensureSpace(doc, rowHeight + 4)
		if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
			doc.addPage()
			drawHeaderRow()
		}

		const y = doc.y
		if (idx % 2 === 0) {
			doc.save()
			doc.rect(left, y, contentWidth, rowHeight).fill('#F8FAFC')
			doc.restore()
		}

		doc.strokeColor(COLORS.border).lineWidth(0.4)
		doc.moveTo(left, y).lineTo(left + contentWidth, y).stroke()

		doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
		doc.text(String(row.item), left + 8, y + 6, { width: widths[0] - 12 })
		doc.text(String(row.score), left + widths[0] + 8, y + 6, { width: widths[1] - 12 })
		doc.text(sanitizePdfText(row.etiqueta), left + widths[0] + widths[1] + 8, y + 6, { width: widths[2] - 12 })
		doc.y = y + rowHeight
	})

	doc.moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).strokeColor(COLORS.border).lineWidth(0.4).stroke()
	doc.moveDown(0.5)
	doc.x = doc.page.margins.left
}

const keyPointsBlock = (doc) => {
	const y = doc.y
	const boxHeight = 92
	const x = doc.page.margins.left
	const width = doc.page.width - doc.page.margins.left - doc.page.margins.right

	doc.save()
	doc.roundedRect(x, y, width, boxHeight, 6).fill('#FFF7E6')
	doc.restore()

	doc.fillColor('#7A4B00').font('Helvetica-Bold').fontSize(11)
	doc.text('Puntos clave esperados en la interpretacion', x + 12, y + 10)

	doc.fillColor(COLORS.text).font('Helvetica').fontSize(10)
	const bulletX = x + 16
	doc.text('- Identificacion del instrumento y criterios del manual', bulletX, y + 30)
	doc.text('- Calidad del protocolo y aplicabilidad de normas', bulletX)
	doc.text('- Perfil probable, hipotesis tentativa y recomendaciones', bulletX)
	doc.text('- Aclaracion metodologica y advertencia etica', bulletX)
	doc.y = y + boxHeight + 8
}

const toPatientRows = ({ numeroUsuario, patientData }) => {
	const fallback = patientData || {}
	const rows = [
		{ label: 'Nombres', value: fallback.nombres || 'No disponible' },
		{ label: 'Apellidos', value: fallback.apellidos || 'No disponible' },
		{ label: 'Correo', value: fallback.correo || 'No disponible' },
		{ label: 'Telefono', value: fallback.telefonoPrincipal || numeroUsuario || 'No disponible' },
		{ label: '# Documento', value: `${fallback.tipoDocumento || 'No disponible'} ${fallback.documento || ''}`.trim() },
		{ label: 'Edad', value: fallback.edad || 'No disponible' },
		{ label: 'Fecha nacimiento', value: fallback.fechaNacimiento || 'No disponible' },
	]

	if (fallback.semestre) rows.push({ label: 'Semestre', value: fallback.semestre })
	if (fallback.carrera) rows.push({ label: 'Carrera', value: fallback.carrera })
	if (fallback.jornada) rows.push({ label: 'Jornada', value: fallback.jornada })

	return rows
}

export const generateInterpretationPdf = async ({ numeroUsuario, testId, interpretation, rawResults, patientData }) => {
	return new Promise((resolve, reject) => {
		try {
			const tempDir = ensureTempDir()
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
			const safeUser = String(numeroUsuario || 'usuario').replace(/[^a-zA-Z0-9_-]/g, '_')
			const safeTest = String(testId || 'test').replace(/[^a-zA-Z0-9_-]/g, '_')
			const fileName = `reporte_${safeTest}_${safeUser}_${timestamp}.pdf`
			const filePath = path.join(tempDir, fileName)

			const doc = new PDFDocument({ margin: 42, size: 'A4' })
			const stream = fs.createWriteStream(filePath)
			doc.pipe(stream)

			drawHeader(
				doc,
				'Informe de interpretacion tecnica',
				`Prueba: ${String(testId || '').toUpperCase()}   |   Fecha elaboracion: ${new Date().toLocaleString('es-CO')}`
			)

			drawSectionTitle(doc, '1) Ficha del paciente')
			drawKeyValueGrid(doc, toPatientRows({ numeroUsuario, patientData }))

			drawSectionTitle(doc, '2) Respuestas del protocolo')
			const items = itemRowsFromRawResults(rawResults, testId)
			if (items.length > 0) {
				drawItemsTable(doc, items)
			} else {
				doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text('No hay respuestas registradas para este protocolo.')
				doc.moveDown(0.6)
			}

			drawSectionTitle(doc, '3) Interpretacion tecnica')
			keyPointsBlock(doc)
			ensureSpace(doc, 140)
			doc.moveDown(0.3)
			drawInterpretationContent(doc, interpretation || 'No disponible')

			doc.moveDown(1)
			doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary)
			doc.text('Nota: Este informe es de apoyo profesional y debe integrarse con entrevista clinica presencial.', { align: 'center' })

			doc.end()

			stream.on('finish', () => resolve(filePath))
			stream.on('error', reject)
		} catch (error) {
			reject(error)
		}
	})
}
