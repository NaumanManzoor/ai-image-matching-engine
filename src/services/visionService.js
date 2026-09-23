const fs = require('fs');
const path = require('path');
const config = require('../config');
const { ai } = require('./geminiClient');
const { trackCall } = require('./costService');
const { TagSchema, tagJsonSchema } = require('./tagSchema');

const CORPUS_DIR = path.join(__dirname, '..', '..', 'corpus');

const PROMPT = `You are an image classifier. Describe the MAIN subject of this image.
Rules:
- "subject": the most specific common name you can justify (e.g. "red fox", "gray wolf",
  "husky", "brown bear", "white-tailed deer"), lowercase.
- "category": one of the allowed values.
- "attributes": 3-6 short visual descriptors (colour, setting, pose, lighting).
- "caption": one plain sentence describing the image.
- "confidence": 0 to 1, how sure you are about "subject".
  If the subject is small, far away, blurry, dark, foggy, a silhouette, or partly hidden,
  confidence MUST be below 0.6. Do not guess confidently.`;

class InvalidModelOutputError extends Error {}

async function tagImage(image) {
  const bytes = fs.readFileSync(path.join(CORPUS_DIR, image.filename));

  const raw = await trackCall(
    { kind: 'vision', model: config.VISION_MODEL, ownerType: 'image', ownerId: image.id },
    async () => {
      const response = await ai.models.generateContent({
        model: config.VISION_MODEL,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: bytes.toString('base64') } },
            { text: PROMPT },
          ],
        }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: tagJsonSchema,
          temperature: 0,
        },
      });
      return { result: response.text, usage: response.usageMetadata };
    }
  );

  // Never trust model output: parse, then validate against the Zod schema.
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidModelOutputError(`Model returned non-JSON: ${String(raw).slice(0, 200)}`);
  }
  const check = TagSchema.safeParse(parsed);
  if (!check.success) {
    const issues = check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new InvalidModelOutputError(`Model output failed schema validation: ${issues}`);
  }

  const tags = check.data;
  tags.subject = tags.subject.toLowerCase();
  return { tags, flagged: tags.confidence < config.CONFIDENCE_MIN };
}

module.exports = { tagImage, InvalidModelOutputError };