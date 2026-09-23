// Lists the Gemini models this API key can use, grouped by what they support.
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pager = await ai.models.list();
  const generate = [];
  const embed = [];

  for await (const model of pager) {
    const name = model.name.replace('models/', '');
    const actions = model.supportedActions || [];
    if (actions.includes('generateContent')) generate.push(name);
    if (actions.includes('embedContent')) embed.push(name);
  }

  console.log('Vision / text models (use for VISION_MODEL):');
  generate.filter((n) => n.includes('flash')).forEach((n) => console.log('  ' + n));
  console.log('\nEmbedding models (use for EMBED_MODEL):');
  embed.forEach((n) => console.log('  ' + n));
}

main().catch((err) => {
  console.error('List failed:', err.message);
  process.exit(1);
});