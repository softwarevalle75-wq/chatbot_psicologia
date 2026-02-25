// import { generateAnswer } from '../src/RAG/generator.js'

// /**
//  * Script de prueba rápida para validar funcionamiento del RAG
//  * Principio: Smoke Testing - verificación básica del sistema
//  */

// async function quickTest() {
//     console.log('🧪 Test Rápido del Sistema RAG')
//     console.log('='.repeat(40))

//     try {
//         // Test 1: Retrieval básico
//         console.log('\n📍 1. Probando Retrieval Básico...')
//         const query = "¿Cuál es el punto de corte del GHQ-12?"
//         console.log(`   🔍 Query: ${query}`)
        
//         let chunks = []
        
//         // Último recurso: llamada directa a Qdrant
//         try {
//             console.log('   🔍 Probando llamada directa a Qdrant...')
//             const { getQdrantClient, getCollectionName } = await import('../src/RAG/client.js')
//             const client = getQdrantClient()
//             const collectionName = getCollectionName()
//             const { generateEmbedding } = await import('../src/RAG/client.js')
//             const queryVector = await generateEmbedding(query)
            
//             console.log(`   🔍 Colección: ${collectionName}`)
//             console.log(`   🔍 Vector length: ${queryVector.length}`)
            
//             const results = await client.search(collectionName, {
//                 vector: queryVector,
//                 limit: 5,
//                 // Sin filtro
//             })
            
//             console.log(`   ✅ Búsqueda directa exitosa: ${results.length} resultados`)
//             if (results.length > 0) {
//                 console.log(`   📄 Primer resultado: ${results[0].payload?.text?.substring(0, 100)}...`)
//                 console.log(`   🔍 Payload:`, JSON.stringify(results[0].payload, null, 2))
                
//                 // Asignar chunks para el test de generación
//                 chunks = results
                
//                 // Test 1.5: Reranking semántico
//                 console.log('\n🔄 1.5. Probando Reranking Semántico...')
//                 try {
//                     const { rerankBySemanticSimilarity } = await import('../src/RAG/retriever.js')
//                     const rerankedChunks = await rerankBySemanticSimilarity(query, results)
                    
//                     console.log(`   ✅ Reranking exitoso: ${rerankedChunks.length} chunks`)
//                     if (rerankedChunks.length > 0) {
//                         console.log(`   📊 Chunk 1 (original): Score=${results[0].score}`)
//                         console.log(`   📊 Chunk 1 (rerankeado): Score=${rerankedChunks[0].score}`)
//                         console.log(`   📊 Mejora: ${((rerankedChunks[0].score - results[0].score) * 100).toFixed(1)}%`)
                        
//                         // Usar chunks rerankeados para generación
//                         chunks = rerankedChunks
//                     }
//                 } catch (rerankError) {
//                     console.log('   ❌ Error en reranking:', rerankError.message)
//                 }
//             }
//         } catch (directError) {
//             console.log('   ❌ Error en llamada directa:', directError.message)
//             console.log('   🔍 Stack:', directError.stack)
//         }

//         // Test 2: Generación
//         console.log('\n🤖 2. Probando Generación...')
//         const generationResult = await generateAnswer(query, chunks)
        
//         console.log(`   Respuesta generada: ${generationResult.answer}`)
//         console.log(`   Success: ${generationResult.success}`)
//         console.log(`   Tokens usados: ${generationResult.metadata.totalTokens || 'N/A'}`)

//         // Test 3: Pregunta negativa
//         console.log('\n❌ 3. Probando Pregunta Negativa...')
//         const negativeQuery = "¿Cuánto cuesta una terapia?"
//         const negativeResult = await generateAnswer(negativeQuery, [])
        
//         console.log(`   Query: ${negativeQuery}`)
//         console.log(`   Respuesta: ${negativeResult.answer}`)
//         console.log(`   Contiene "no se encuentra": ${negativeResult.answer.toLowerCase().includes('no se encuentra')}`)

//         console.log('\n✅ Test rápido completado exitosamente')
//         console.log('💡 Para evaluación completa ejecuta: npm run test:rag-eval')

//     } catch (error) {
//         console.error('\n❌ Error en test rápido:', error.message)
//         console.error('🔍 Verifica:')
//         console.error('   • Variables de entorno (.env)')
//         console.error('   • Conexión a Qdrant')
//         console.error('   • API key de OpenAI')
//         process.exit(1)
//     }
// }

// quickTest()
