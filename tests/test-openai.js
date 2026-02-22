import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI();
console.log('Probando solo OpenAI...');

try {
  const response = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [{role: 'user', content: 'Di solo: Funciona OpenAI'}],
    max_completion_tokens: 200,
  });
    console.log('✅ OpenAI funciona:', response.choices[0].message.content);
} catch(e) {
  console.log(`❌ Error OpenAI:`, e.message);
}
