require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: process.env.VISION_MODEL,
    contents: 'Reply with exactly: Gemini is working',
  });
  console.log(res.text);
}

main().catch((err) => {
  console.error('Gemini test failed:', err.message);
  process.exit(1);
});