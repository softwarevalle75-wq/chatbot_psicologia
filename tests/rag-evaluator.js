import fs from 'fs'
import path from 'path'
import { generateAnswer } from '../src/RAG/generator.js'
import { searchOnly, rerankBySemanticSimilarity } from '../src/RAG/retriever-improved.js'

/**
 * Framework de evaluación completo para sistema RAG
 * Principio: Strategy Pattern - diferentes estrategias de evaluación
 */

/**
 * Clase principal para manejar evaluaciones
 * Principio: Single Responsibility - coordinar todas las evaluaciones
 */
class RAGEvaluator {
    constructor(evaluationSetPath, outputPath = './results') {
        this.evaluationSet = this.loadEvaluationSet(evaluationSetPath)
        this.outputPath = outputPath
        this.results = {
            retrieval: {},
            generation: {},
            chunking: {},
            summary: {}
        }
    }

    /**
     * Carga el dataset de evaluación
     * Principio: Fail Fast - validar archivo al inicio
     */
    loadEvaluationSet(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`Archivo no encontrado: ${filePath}`)
            }
            
            const content = fs.readFileSync(filePath, 'utf8')
            const data = JSON.parse(content)
            
            if (!data.questions || !Array.isArray(data.questions)) {
                throw new Error('Formato inválido: se requiere array de preguntas')
            }
            
            console.log(`✅ Dataset cargado: ${data.questions.length} preguntas`)
            return data
        } catch (error) {
            console.error('❌ Error cargando dataset:', error.message)
            throw error
        }
    }

    /**
     * Ejecuta evaluación completa del pipeline
     * Principio: Template Method - estructura definida, pasos variables
     */
    async runFullEvaluation() {
        console.log('🚀 Iniciando evaluación completa del RAG')
        console.log('='.repeat(60))

        try {
            // 1. Evaluación de Retrieval
            console.log('\n📊 1. Evaluando Retrieval...')
            await this.evaluateRetrieval()

            // 2. Evaluación de Generación
            console.log('\n🤖 2. Evaluando Generación...')
            await this.evaluateGeneration()

            // 3. Evaluación de Integridad de Chunking
            console.log('\n🔩 3. Evaluando Integridad de Chunking...')
            await this.evaluateChunking()

            // 4. Generar reporte final
            console.log('\n📋 4. Generando Reporte Final...')
            this.generateFinalReport()

            // 5. Guardar resultados
            this.saveResults()

            console.log('\n✅ Evaluación completada exitosamente')
            return this.results

        } catch (error) {
            console.error('❌ Error en evaluación:', error.message)
            throw error
        }
    }

    /**
     * Evalúa el rendimiento del retrieval mejorado
     * Principio: Strategy - diferentes métricas de evaluación
     */
    async evaluateRetrieval() {
        const positiveQuestions = this.evaluationSet.questions.filter(q => q.source !== 'NEGATIVE')
        let totalP1 = 0, totalP3 = 0, totalP5 = 0
        let rerankingImprovements = []

        for (const question of positiveQuestions) {
            try {
                // Retrieval inicial con el sistema mejorado
                const initialResults = await searchOnly(question.question, question.source, 5)
                
                // Re-ranking real por similitud semántica
                const rerankedResults = await rerankBySemanticSimilarity(question.question, initialResults)
                
                // Calcular precision@k
                const precisionMetrics = this.calculatePrecisionAtK(initialResults, rerankedResults, question)
                
                totalP1 += precisionMetrics.initial.p1
                totalP3 += precisionMetrics.initial.p3  
                totalP5 += precisionMetrics.initial.p5
                
                // Medir mejora por re-ranking
                const improvement = this.calculateRerankingImprovement(initialResults, rerankedResults, question)
                rerankingImprovements.push(improvement)

                console.log(`   📝 ${question.id}: P@1=${precisionMetrics.initial.p1}, P@3=${precisionMetrics.initial.p3}, P@5=${precisionMetrics.initial.p5} [Mejora: ${(improvement * 100).toFixed(1)}%]`)

            } catch (error) {
                console.error(`   ❌ Error evaluando ${question.id}:`, error.message)
            }
        }

        const n = positiveQuestions.length
        this.results.retrieval = {
            precision_at_1: totalP1 / n,
            precision_at_3: totalP3 / n,
            precision_at_5: totalP5 / n,
            reranking_improvement: rerankingImprovements.reduce((a, b) => a + b, 0) / rerankingImprovements.length,
            total_questions: n
        }
    }

    /**
     * Evalúa la calidad de generación
     * Principio: Builder Pattern - construcción de evaluación paso a paso
     */
    async evaluateGeneration() {
        let groundedCount = 0
        let hallucinationCount = 0
        let negativeCorrectCount = 0
        const totalQuestions = this.evaluationSet.questions.length

        for (const question of this.evaluationSet.questions) {
            try {
                // Recuperar contexto
                const retrievedChunks = await searchOnly(question.question, 
                    question.source === 'NEGATIVE' ? 'GHQ-12' : question.source, 5)

                // Generar respuesta
                const generationResult = await generateAnswer(question.question, retrievedChunks)
                
                if (!generationResult.success) {
                    console.error(`   ❌ Error generando respuesta para ${question.id}`)
                    continue
                }

                // Evaluar respuesta
                const evaluation = this.evaluateGenerationResult(generationResult.answer, question)
                
                if (evaluation.isGrounded) groundedCount++
                if (evaluation.hasHallucination) hallucinationCount++
                if (evaluation.isNegativeCorrect) negativeCorrectCount++

                console.log(`   🤖 ${question.id}: ${evaluation.isGrounded ? '✅' : '❌'} Grounded | ${evaluation.hasHallucination ? '❌' : '✅'} No Hallucination`)

            } catch (error) {
                console.error(`   ❌ Error evaluando generación ${question.id}:`, error.message)
            }
        }

        this.results.generation = {
            grounded_accuracy: groundedCount / totalQuestions,
            hallucination_rate: hallucinationCount / totalQuestions,
            negative_correctness: negativeCorrectCount / this.evaluationSet.questions.filter(q => q.source === 'NEGATIVE').length,
            total_questions: totalQuestions
        }
    }

    /**
     * Evalúa integridad del chunking
     * Principio: Specification Pattern - diferentes validaciones
     */
    async evaluateChunking() {
        console.log('   🔍 Analizando chunks generados...')
        
        const tempDir = path.resolve(process.cwd(), './temp')
        const chunkFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('-extracted.json'))
        
        let integrityResults = []

        for (const file of chunkFiles) {
            const filePath = path.join(tempDir, file)
            const analysis = await this.analyzeChunkIntegrity(filePath)
            integrityResults.push(analysis)
        }

        const allPassed = integrityResults.every(r => r.passed)
        
        this.results.chunking = {
            passed: allPassed,
            details: integrityResults,
            summary: {
                total_files: chunkFiles.length,
                passed_files: integrityResults.filter(r => r.passed).length,
                failed_files: integrityResults.filter(r => !r.passed).length
            }
        }
    }

    /**
     * Analiza integridad de chunks en un archivo específico
     */
    async analyzeChunkIntegrity(filePath) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
            const chunks = data.chunks || []
            
            const issues = []
            
            // 1. Verificar que ningún chunk corte palabras
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i]
                const text = chunk.text || chunk.payload?.text || ''
                
                if (text.length > 255) {
                    issues.push(`Chunk ${i}: Excede 255 caracteres (${text.length})`)
                }
                
                // Verificar cortes de palabras (simplificado)
                if (text.endsWith(' ') || text.endsWith('\n')) {
                    // OK - termina en espacio o salto de línea
                } else if (text.length === 255) {
                    // Verificar si corta palabra buscando el último espacio
                    const lastSpaceIndex = text.lastIndexOf(' ')
                    if (lastSpaceIndex > 200) { // Si el último espacio está muy al final, probablemente cortó
                        issues.push(`Chunk ${i}: Posible corte de palabra`)
                    }
                }
            }
            
            // 2. Verificar overlap (aproximado)
            for (let i = 1; i < Math.min(chunks.length, 5); i++) { // Solo primeros 5 para eficiencia
                const prevChunk = chunks[i-1].text || chunks[i-1].payload?.text || ''
                const currChunk = chunks[i].text || chunks[i].payload?.text || ''
                
                const expectedOverlap = prevChunk.slice(-60).trim()
                const actualStart = currChunk.substring(0, 60).trim()
                
                if (expectedOverlap && actualStart && !actualStart.includes(expectedOverlap.substring(0, 20))) {
                    issues.push(`Overlap incorrecto entre chunks ${i-1} y ${i}`)
                }
            }

            return {
                file: path.basename(filePath),
                passed: issues.length === 0,
                issues,
                chunk_count: chunks.length
            }

        } catch (error) {
            return {
                file: path.basename(filePath),
                passed: false,
                issues: [`Error analizando archivo: ${error.message}`],
                chunk_count: 0
            }
        }
    }

    /**
     * Re-rankea resultados por similitud semántica
     * Principio: Strategy - diferente algoritmo de ranking
     */
    async rerankBySimilarity(query, results) {
        // Implementación simplificada - en producción usar embeddings reales
        return results.sort((a, b) => b.score - a.score)
    }

    /**
     * Calcula métricas de precisión@k
     */
    calculatePrecisionAtK(initialResults, rerankedResults, question) {
        const hasKeyword = (result) => {
            const text = result.payload?.text || ''
            return question.expected_keywords.some(keyword => 
                text.toLowerCase().includes(keyword.toLowerCase())
            )
        }

        const calculateP = (results, k) => {
            const topK = results.slice(0, k)
            const relevant = topK.filter(hasKeyword).length
            return relevant / Math.min(k, results.length)
        }

        return {
            initial: {
                p1: calculateP(initialResults, 1),
                p3: calculateP(initialResults, 3),
                p5: calculateP(initialResults, 5)
            },
            reranked: {
                p1: calculateP(rerankedResults, 1),
                p3: calculateP(rerankedResults, 3),
                p5: calculateP(rerankedResults, 5)
            }
        }
    }

    /**
     * Calcula mejora por re-ranking
     */
    calculateRerankingImprovement(initial, reranked, question) {
        const hasKeyword = (result) => {
            const text = result.payload?.text || ''
            return question.expected_keywords.some(keyword => 
                text.toLowerCase().includes(keyword.toLowerCase())
            )
        }

        const findFirstRelevant = (results) => {
            return results.findIndex(hasKeyword)
        }

        const initialPos = findFirstRelevant(initial)
        const rerankedPos = findFirstRelevant(reranked)
        
        if (initialPos === -1 && rerankedPos === -1) return 0
        if (initialPos === -1) return 1
        if (rerankedPos === -1) return -1
        
        return (initialPos - rerankedPos) / Math.max(initialPos, rerankedPos)
    }

    /**
     * Evalúa resultado de generación
     */
    evaluateGenerationResult(answer, question) {
        const lowerAnswer = answer.toLowerCase()
        
        if (question.source === 'NEGATIVE') {
            return {
                isGrounded: false,
                hasHallucination: false,
                isNegativeCorrect: lowerAnswer.includes('información no se encuentra') || 
                                 lowerAnswer.includes('no se encuentra en el contexto')
            }
        }

        const hasExpectedKeywords = question.expected_keywords.some(keyword =>
            lowerAnswer.includes(keyword.toLowerCase())
        )

        // Detección simple de alucinaciones (podría mejorarse)
        const hasHallucination = !hasExpectedKeywords && answer.length > 50

        return {
            isGrounded: hasExpectedKeywords,
            hasHallucination,
            isNegativeCorrect: false
        }
    }

    /**
     * Genera reporte final de evaluación
     */
    generateFinalReport() {
        const { retrieval, generation, chunking } = this.results
        
        console.log('\n' + '='.repeat(60))
        console.log('📊 REPORTE FINAL DE EVALUACIÓN')
        console.log('='.repeat(60))
        
        console.log('\n🔍 RETRIEVAL:')
        console.log(`   Precision@1: ${(retrieval.precision_at_1 || 0).toFixed(3)}`)
        console.log(`   Precision@3: ${(retrieval.precision_at_3 || 0).toFixed(3)}`)
        console.log(`   Precision@5: ${(retrieval.precision_at_5 || 0).toFixed(3)}`)
        console.log(`   Mejora Re-ranking: ${((retrieval.reranking_improvement || 0) * 100).toFixed(1)}%`)
        
        console.log('\n🤖 GENERACIÓN:')
        console.log(`   Grounded Accuracy: ${(generation.grounded_accuracy || 0).toFixed(3)}`)
        console.log(`   Hallucination Rate: ${(generation.hallucination_rate || 0).toFixed(3)}`)
        console.log(`   Negative Correctness: ${(generation.negative_correctness || 0).toFixed(3)}`)
        
        console.log('\n🔩 CHUNKING INTEGRITY:')
        console.log(`   Status: ${chunking.passed ? '✅ PASS' : '❌ FAIL'}`)
        console.log(`   Archivos: ${chunking.summary?.passed_files || 0}/${chunking.summary?.total_files || 0} pasaron`)
        
        // Resumen final
        const overallScore = this.calculateOverallScore()
        console.log(`\n🏆 OVERALL SCORE: ${overallScore}/100`)
        
        this.results.summary = {
            overall_score: overallScore,
            retrieval_grade: this.getGrade(retrieval.precision_at_3 || 0),
            generation_grade: this.getGrade(generation.grounded_accuracy || 0),
            chunking_grade: chunking.passed ? 'A' : 'F'
        }
    }

    /**
     * Calcula score general del sistema
     */
    calculateOverallScore() {
        const { retrieval, generation, chunking } = this.results
        
        const retrievalScore = (retrieval.precision_at_3 || 0) * 40 // 40% peso
        const generationScore = (generation.grounded_accuracy || 0) * 40 // 40% peso
        const chunkingScore = chunking.passed ? 20 : 0 // 20% peso
        
        return Math.round(retrievalScore + generationScore + chunkingScore)
    }

    /**
     * Convierte score a letra (grading)
     */
    getGrade(score) {
        if (score >= 0.9) return 'A'
        if (score >= 0.8) return 'B'
        if (score >= 0.7) return 'C'
        if (score >= 0.6) return 'D'
        return 'F'
    }

    /**
     * Guarda resultados en archivo JSON
     */
    saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `rag-evaluation-${timestamp}.json`
        const filepath = path.join(this.outputPath, filename)
        
        // Asegurar que existe el directorio
        if (!fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath, { recursive: true })
        }
        
        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2))
        console.log(`\n💾 Resultados guardados en: ${filepath}`)
    }
}

export { RAGEvaluator }
