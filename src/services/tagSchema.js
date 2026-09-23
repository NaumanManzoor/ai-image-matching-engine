const { z } = require('zod');

const CATEGORIES = ['animal', 'plant', 'landscape', 'object', 'person', 'other'];

// Zod schema: the single source of truth for what a valid tag looks like.
const TagSchema = z.object({
  subject: z.string().trim().min(2),
  category: z.enum(CATEGORIES),
  attributes: z.array(z.string().trim().min(1)).min(1).max(8),
  caption: z.string().trim().min(5),
  confidence: z.number().min(0).max(1),
});

// The same shape as plain JSON Schema, sent to Gemini so it returns structured output.
const tagJsonSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string', description: 'Most specific name of the main subject, e.g. "red fox", "gray wolf", "golden retriever"' },
    category: { type: 'string', enum: CATEGORIES },
    attributes: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
    caption: { type: 'string', description: 'One sentence describing the image' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['subject', 'category', 'attributes', 'caption', 'confidence'],
};

module.exports = { TagSchema, tagJsonSchema, CATEGORIES };