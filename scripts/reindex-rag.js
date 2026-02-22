import 'dotenv/config'
import { reindexAll } from '../src/RAG/index.js'
console.log('🔄 Re-indexando RAG...')
reindexAll()
	.then(results => {
		console.log('✅ Re-indexación completa:', results)
		process.exit(0)
	})
	.catch(err => {
		console.error('❌ Error:', err)
		process.exit(1)
	})