const { z } = require('zod');
const config = require('../config');
const { ai } = require('./geminiClient');
const { trackCall } = require('./costService');
const { CATEGORIES } = require('./tagSchema');

const PostAnalysisSchema = z.object({
  subject: z.string().trim().min(2),
  category: z.enum(CATEGORIES),
});

const postAnalysisJsonSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    category: { type: 'string', enum: CATEGORIES },
  },
  required: ['subject', 'category'],
};

const PROMPT = `Read this blog post and say what its main subject is.
- "subject": the main animal, plant or thing the post is about, as a lowercase common English name,
  at the level of detail the post uses (e.g. "red fox", "gray wolf", "dog", "brown bear", "deer",
  "goldfish", "mountain bike"). Translate scientific names to the common name.
- "category": one of the allowed values.`;

async function analyzePost(post) {
  const raw = await trackCall(
    { kind: 'analyze', model: config.VISION_MODEL, ownerType: 'post', ownerId: post.id },
    async () => {
      const response = await ai.models.generateContent({
        model: config.VISION_MODEL,
        contents: `${PROMPT}\n\nTITLE: ${post.title}\n\n${post.body}`,
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: postAnalysisJsonSchema,
          temperature: 0,
        },
      });
      return { result: response.text, usage: response.usageMetadata };
    }
  );

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Post analysis returned non-JSON: ${String(raw).slice(0, 200)}`);
  }
  const check = PostAnalysisSchema.safeParse(parsed);
  if (!check.success) {
    throw new Error(`Post analysis failed validation: ${check.error.issues.map((i) => i.message).join('; ')}`);
  }
  return { subject: check.data.subject.toLowerCase(), category: check.data.category };
}

module.exports = { analyzePost };