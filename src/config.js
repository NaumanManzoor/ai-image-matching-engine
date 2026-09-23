require('dotenv').config();

function num(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (Number.isNaN(value)) throw new Error(`${name} must be a number`);
  return value;
}

module.exports = {
  PORT: num('PORT', 3000),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  VISION_MODEL: process.env.VISION_MODEL,
  EMBED_MODEL: process.env.EMBED_MODEL,
  CONFIDENCE_MIN: num('CONFIDENCE_MIN', 0.6),
  MATCH_THRESHOLD: num('MATCH_THRESHOLD', 0.7),
  SUBJECT_THRESHOLD: num('SUBJECT_THRESHOLD', 0.8),
  DAILY_CALL_BUDGET: num('DAILY_CALL_BUDGET', 500),
  VISION_DELAY_MS: num('VISION_DELAY_MS', 6000),
  EMBED_DELAY_MS: num('EMBED_DELAY_MS', 1000),
  EMBED_DIMENSIONS: num('EMBED_DIMENSIONS', 768),
  TOP_K: num('TOP_K', 5),
  PRICE_INPUT_PER_1M: num('PRICE_INPUT_PER_1M', 0),
  PRICE_OUTPUT_PER_1M: num('PRICE_OUTPUT_PER_1M', 0),
  PRICE_EMBED_PER_1M: num('PRICE_EMBED_PER_1M', 0),
};