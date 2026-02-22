import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import pdf from 'pdf-parse'
import { TEST_SOURCES, getEnabledSources } from '../src/RAG/sources.js'

const CHUNK_SIZE = 255
const CHUNK_OVERLAP = 60

const createHash = (text) => {
    return crypto.createHash('sha256').update(text).digest('hex')
}

const formatTableAsText = (table, pageNumber) => {
    const header = table.data[0] || []
    const rows = table.data.slice(1) || []
    let text = `\n[TABLA ${table.tableNumber} - Página ${pageNumber}]\n`
    text += `Columnas: ${table.numcols} | Filas: ${table.numrows}\n`
    if (header.length > 0) {
        text += '| ' + header.join(' | ') + ' |\n'
        text += '|' + header.map(() => '---').join('|') + '|\n'
    }
    for (const row of rows) {
        text += '| ' + row.join(' | ') + ' |\n'
    }
    return text + '\n'
}

const parsePDF = async (filePath) => {
    console.log(`📄 Procesando: ${path.basename(filePath)}`)
    
    const dataBuffer = fs.readFileSync(filePath)
    
    // Extraer texto con pdf-parse
    const textData = await pdf(dataBuffer)
    console.log(`   📊 Páginas: ${textData.numpages}`)
    console.log(`   📝 Caracteres: ${textData.text.length}`)
    
    // Por ahora, solo extraer texto sin tablas (pdf-tables-parser tiene problemas)
    // TODO: Implementar extracción de tablas alternativa cuando se necesite
    
    console.log(`   📋 Tablas encontradas: 0 (extracción de tablas deshabilitada temporalmente)`)
    
    return {
        text: textData.text,
        numPages: textData.numpages,
        tablesCount: 0,
        tables: [],
        originalText: textData.text,
        tablesText: ''
    }
}

const chunkText = (text, metadata) => {
    const chunks = []
    let chunkIndex = 0
    let currentPage = metadata.pageStart || 1

    // Función para encontrar el mejor punto de corte sin cortar palabras
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
        for (const match of singleNewlines.reverse()) { // Buscar desde el final
            if (match.index < maxLength - 1) { // -1 para no cortar en la última línea
                return match.index + 1
            }
        }

        // 3. Buscar punto seguido (.)
        const periods = [...text.matchAll(/\./g)]
        for (const match of periods.reverse()) { // Buscar desde el final
            if (match.index < maxLength - 2) { // -2 para dejar espacio después del punto
                // Verificar que no sea una abreviatura común
                const afterPeriod = text.substring(match.index + 1).trim()
                if (afterPeriod.length > 0 && afterPeriod[0] === afterPeriod[0].toUpperCase()) {
                    return match.index + 1
                }
            }
        }

        // 4. Buscar espacio para no cortar palabra
        const spaces = [...text.matchAll(/ /g)]
        for (const match of spaces.reverse()) { // Buscar desde el final
            if (match.index < maxLength - 1) {
                return match.index
            }
        }

        // 5. Último recurso: cortar por longitud (evitar esto si es posible)
        return maxLength
    }

    // Función para crear overlap manteniendo continuidad
    const createOverlap = (text, overlapLength) => {
        if (text.length <= overlapLength) return text

        // Buscar un buen punto de inicio para el overlap
        const overlapStart = text.length - overlapLength
        const firstSpace = text.indexOf(' ', overlapStart)

        if (firstSpace !== -1 && firstSpace < text.length) {
            return text.substring(firstSpace + 1)
        }

        return text.substring(overlapStart)
    }

    let remainingText = text.trim()
    let lastOverlap = ''

    while (remainingText.length > 0) {
        let chunkText = ''

        // Si tenemos overlap del chunk anterior, usarlo como inicio
        if (lastOverlap) {
            const availableSpace = CHUNK_SIZE - lastOverlap.length
            if (availableSpace > 50) { // Mínimo espacio para contenido significativo
                const breakPoint = findBestBreakPoint(remainingText, availableSpace)
                chunkText = lastOverlap + remainingText.substring(0, breakPoint).trim()
                remainingText = remainingText.substring(breakPoint).trim()
            } else {
                // El overlap es muy grande, usar solo el overlap
                chunkText = lastOverlap
                // No consumir texto nuevo en este chunk
            }
            lastOverlap = ''
        } else {
            // Primer chunk o sin overlap
            const breakPoint = findBestBreakPoint(remainingText, CHUNK_SIZE)
            chunkText = remainingText.substring(0, breakPoint).trim()
            remainingText = remainingText.substring(breakPoint).trim()
        }

        // Crear overlap para el siguiente chunk (si queda texto)
        if (remainingText.length > 0) {
            lastOverlap = createOverlap(chunkText, CHUNK_OVERLAP)
        }

        // Agregar chunk si tiene contenido significativo
        if (chunkText.length > 10) {
            chunks.push({
                id: createHash(`${metadata.docId}-${chunkIndex}`),
                payload: {
                    docId: metadata.docId,
                    docName: metadata.docName,
                    source: metadata.source,
                    version: metadata.version,
                    chunkIndex,
                    pageStart: currentPage,
                    pageEnd: currentPage,
                    text: chunkText,
                    textHash: createHash(chunkText),
                    length: chunkText.length,
                    hasTable: chunkText.includes('[TABLA'),
                    updatedAt: new Date().toISOString(),
                },
            })
            chunkIndex++
        }
    }

    return chunks
}

const processDocumentOffline = async (sourceConfig) => {
    console.log(`\n🔄 Procesando: ${sourceConfig.name}`)
    console.log('='.repeat(60))
    
    if (!fs.existsSync(sourceConfig.manualPath)) {
        console.warn(`⚠️  Archivo no encontrado: ${sourceConfig.manualPath}`)
        return { success: false, error: 'File not found' }
    }
    
    // Parsear PDF
    const { text, numPages, tablesCount, tables, originalText, tablesText } = await parsePDF(sourceConfig.manualPath)
    
    // Crear chunks
    const docId = sourceConfig.name.toLowerCase().replace(/-/g, '_')
    const chunks = chunkText(text, {
        docId,
        docName: sourceConfig.name,
        source: sourceConfig.name,
        version: sourceConfig.version,
        pageStart: 1,
    })
    
    // Estadísticas
    const chunksWithTables = chunks.filter(c => c.payload.hasTable)
    const totalChars = chunks.reduce((sum, c) => sum + c.payload.length, 0)
    
    const result = {
        document: {
            name: sourceConfig.name,
            source: sourceConfig.name,
            version: sourceConfig.version,
            processedAt: new Date().toISOString(),
            stats: {
                pages: numPages,
                characters: originalText.length,
                tables: tablesCount,
                chunks: chunks.length,
                chunksWithTables: chunksWithTables.length,
                totalProcessedChars: totalChars
            }
        },
        chunks: chunks.map(c => ({
            id: c.id,
            text: c.payload.text,
            metadata: c.payload
        })),
        tables: tables,
        extraction: {
            originalTextLength: originalText.length,
            tablesTextLength: tablesText.length,
            combinedTextLength: text.length,
            compressionRatio: ((text.length - originalText.length) / originalText.length * 100).toFixed(2) + '%'
        }
    }
    
    // Guardar resultado
    const outputPath = path.resolve(process.cwd(), './temp', `${docId}-extracted.json`)
    
    // Asegurar que existe la carpeta temp
    if (!fs.existsSync('./temp')) {
        fs.mkdirSync('./temp', { recursive: true })
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
    
    console.log(`\n✅ Procesamiento completado:`)
    console.log(`   📄 Páginas: ${numPages}`)
    console.log(`   📝 Caracteres: ${originalText.length.toLocaleString()}`)
    console.log(`   📋 Tablas: ${tablesCount}`)
    console.log(`   🔩 Chunks: ${chunks.length} (${chunksWithTables.length} con tablas)`)
    console.log(`   💾 Guardado en: ${outputPath}`)
    
    return { success: true, result, outputPath }
}

const main = async () => {
    console.log('🚀 Procesamiento Offline de PDFs para RAG')
    console.log('='.repeat(60))
    
    const results = []
    
    for (const source of getEnabledSources()) {
        try {
            const result = await processDocumentOffline(source)
            results.push({ source: source.name, ...result })
        } catch (error) {
            console.error(`❌ Error procesando ${source.name}:`, error.message)
            results.push({ source: source.name, success: false, error: error.message })
        }
    }
    
    // Resumen final
    console.log('\n' + '='.repeat(60))
    console.log('📊 RESUMEN DE PROCESAMIENTO')
    console.log('='.repeat(60))
    
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    
    if (successful.length > 0) {
        console.log(`\n✅ Documentos procesados exitosamente: ${successful.length}`)
        successful.forEach(r => {
            const stats = r.result.document.stats
            console.log(`   📄 ${r.source}: ${stats.pages} páginas, ${stats.tables} tablas, ${stats.chunks} chunks`)
        })
    }
    
    if (failed.length > 0) {
        console.log(`\n❌ Documentos con errores: ${failed.length}`)
        failed.forEach(r => {
            console.log(`   ❌ ${r.source}: ${r.error}`)
        })
    }
    
    console.log(`\n📁 Todos los resultados guardados en ./temp/`)
    console.log('\n🎉 Procesamiento offline completado')
}

main().catch(console.error)
