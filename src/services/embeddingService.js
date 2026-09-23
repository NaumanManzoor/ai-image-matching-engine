const config = require('../config');
const { ai } = require('./geminiClient');
const { trackCall } = require('./costService');

// The Gemini API does not return token counts for embeddings, so we estimate
// (~4 characters per token) to keep the per-call cost log complete.
const estimateTokens = (texts) => Math.ceil(texts.join(' ').length / 4);

// Embeds several texts in ONE API call. Returns one vector per text, same order.
async function embedTexts(texts, { ownerType, ownerId }) {
  return trackCall(
    { kind: 'embed', model: config.EMBED_MODEL, ownerType, ownerId },
    async () => {
      const response = await ai.models.embedContent({
        model: config.EMBED_MODEL,
        contents: texts,
        config: { taskType: 'SEMANTIC_SIMILARITY', outputDimensionality: config.EMBED_DIMENSIONS },
      });
      const vectors = (response.embeddings || []).map((e) => e.values);
      if (vectors.length !== texts.length || vectors.some((v) => !Array.isArray(v) || v.length === 0)) {
        throw new Error(`Embedding API returned ${vectors.length} vectors for ${texts.length} texts`);
      }
      return { result: vectors, usage: { promptTokenCount: estimateTokens(texts) } };
    }
  );
}

// What we embed for an image: its content (what the picture shows) and its subject alone.
function imageTexts(image) {
  return {
    content: `${image.subject}. ${image.caption} Attributes: ${image.attributes.join(', ')}.`,
    subject: image.subject,
  };
}

function postTexts(post) {
  return {
    content: `${post.title}\n\n${post.body}`,
    subject: post.subject,
  };
}

module.exports = { embedTexts, imageTexts, postTexts };