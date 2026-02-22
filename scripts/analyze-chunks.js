import fs from 'fs'
import path from 'path'

const analyzeChunk = (chunk) => {
    const length = chunk.text.length
    return {
        id: chunk.id,
        length,
        hasTable: chunk.text.includes('[TABLA'),
        pageIndex: chunk.payload?.pageStart || chunk.metadata?.pageStart || 1,
        chunkIndex: chunk.payload?.chunkIndex || chunk.metadata?.chunkIndex || 0,
        isFirst: (chunk.payload?.chunkIndex === 0) || (chunk.metadata?.chunkIndex === 0),
        isLast: false, // Se calculará después
        textPreview: chunk.text.substring(0, 100) + (chunk.text.length > 100 ? '...' : '')
    }
}

const analyzeDocument = (filePath) => {
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        const chunks = data.chunks || []
        
        // Marcar el último chunk
        if (chunks.length > 0) {
            chunks[chunks.length - 1].isLast = true
        }
        
        const analyzedChunks = chunks.map(analyzeChunk)
        
        // Estadísticas
        const lengths = analyzedChunks.map(c => c.length)
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length
        const minLength = Math.min(...lengths)
        const maxLength = Math.max(...lengths)
        const chunksWithTables = analyzedChunks.filter(c => c.hasTable).length
        const veryShortChunks = analyzedChunks.filter(c => c.length < 50).length
        const veryLongChunks = analyzedChunks.filter(c => c.length > 400).length
        
        return {
            document: data.document,
            stats: {
                totalChunks: chunks.length,
                avgLength: Math.round(avgLength),
                minLength,
                maxLength,
                chunksWithTables,
                veryShortChunks,
                veryLongChunks
            },
            problematicChunks: analyzedChunks.filter(c => c.length < 50 || c.length > 400),
            sampleChunks: analyzedChunks.slice(0, 3) // Primeros 3 chunks como muestra
        }
    } catch (error) {
        console.error(`Error analizando ${filePath}:`, error.message)
        return null
    }
}

const main = () => {
    const tempDir = path.resolve(process.cwd(), './temp')
    
    if (!fs.existsSync(tempDir)) {
        console.error('❌ Carpeta ./temp no encontrada. Ejecuta primero npm run test:pdf-extract')
        return
    }
    
    const files = fs.readdirSync(tempDir).filter(f => f.endsWith('-extracted.json'))
    
    if (files.length === 0) {
        console.log('❌ No se encontraron archivos -extracted.json en ./temp/')
        return
    }
    
    console.log('📊 ANÁLISIS DE CHUNKS GENERADOS')
    console.log('='.repeat(60))
    
    for (const file of files) {
        const filePath = path.join(tempDir, file)
        const analysis = analyzeDocument(filePath)
        
        if (analysis) {
            console.log(`\n📄 ${analysis.document.name}`)
            console.log(`   Versión: ${analysis.document.version}`)
            console.log(`   Páginas: ${analysis.document.stats.pages}`)
            console.log(`   Caracteres: ${analysis.document.stats.characters.toLocaleString()}`)
            console.log(`\n📈 Estadísticas de Chunks:`)
            console.log(`   Total: ${analysis.stats.totalChunks}`)
            console.log(`   Longitud promedio: ${analysis.stats.avgLength} caracteres`)
            console.log(`   Rango: ${analysis.stats.minLength} - ${analysis.stats.maxLength} caracteres`)
            console.log(`   Con tablas: ${analysis.stats.chunksWithTables}`)
            
            if (analysis.stats.veryShortChunks > 0 || analysis.stats.veryLongChunks > 0) {
                console.log(`\n⚠️  Chunks problemáticos:`)
                if (analysis.stats.veryShortChunks > 0) {
                    console.log(`   Muy cortos (<50): ${analysis.stats.veryShortChunks}`)
                }
                if (analysis.stats.veryLongChunks > 0) {
                    console.log(`   Muy largos (>400): ${analysis.stats.veryLongChunks}`)
                }
            }
            
            console.log(`\n📝 Muestra de chunks:`)
            analysis.sampleChunks.forEach((chunk, i) => {
                console.log(`   Chunk #${chunk.chunkIndex}: ${chunk.length} chars`)
                console.log(`   ${chunk.textPreview}`)
                if (i < analysis.sampleChunks.length - 1) console.log('')
            })
        }
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ Análisis completado')
    console.log('💡 Recomendación: CHUNK_SIZE=255 parece adecuado para estos documentos')
}

main()
