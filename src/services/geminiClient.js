const { GoogleGenAI } = require('@google/genai');
const config = require('../config');

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

module.exports = { ai };