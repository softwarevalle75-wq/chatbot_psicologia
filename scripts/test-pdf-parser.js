import fs from 'fs'
import { createRequire } from 'module'
import { PdfReader } from 'pdfreader'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const testPDF = async (filePath) => {
	console.log(`📄 Probando: ${filePath}`)
	console.log('='.repeat(50))

	const dataBuffer = fs.readFileSync(filePath)
	
	const textData = await pdfParse(dataBuffer)
	console.log(`\n📊 ESTADÍSTICAS (Texto):`)
	console.log(`   Páginas: ${textData.numpages}`)
	console.log(`   Caracteres de texto: ${textData.text.length}`)

	console.log(`\n📋 EXTRAYENDO TABLAS CON PDFREADER...`)
	
	const rows = {}
	let currentPage = 0
	let tablesFound = []

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
			if (item.page) {
				currentPage = item.page
				const pageRows = Object.keys(rows)
					.sort((a, b) => parseFloat(a) - parseFloat(b))
					.map(y => rows[y])
				
				if (pageRows.length > 0) {
					console.log(`\n--- Página ${currentPage} ---`)
					pageRows.forEach(row => {
						console.log('| ' + row.join(' | ') + ' |')
					})
					tablesFound.push({ page: currentPage, rows: pageRows })
				}
				Object.keys(rows).forEach(key => delete rows[key])
			} else if (item.text) {
				const y = item.y !== undefined ? item.y.toFixed(2) : '0'
				if (!rows[y]) rows[y] = []
				rows[y].push(item.text)
			}
		})
	})

	console.log(`\n📊 Total de páginas con contenido tabular: ${tablesFound.length}`)

	console.log(`\n📝 TEXTO (primeros 500 caracteres):`)
	console.log(textData.text.slice(0, 500))
}

const pdfPath = process.argv[2] || './src/data/manuales/DASS21/ruiz2017dass21-1.pdf'
testPDF(pdfPath)
	.then(() => {
		console.log('\n✅ Prueba completada')
		process.exit(0)
	})
	.catch((err) => {
		console.error('❌ Error:', err)
		process.exit(1)
	})
