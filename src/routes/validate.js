const { z } = require('zod');

const IdParams = z.object({ id: z.coerce.number().int().positive() });

// Pick the candidate image by id or by filename (e.g. {"filename": "wolf_01.jpg"}).
const CheckBody = z.object({
  imageId: z.coerce.number().int().positive().optional(),
  filename: z.string().trim().min(1).max(200).optional(),
}).refine((b) => b.imageId || b.filename, { message: 'Provide imageId or filename' });

const ReviewBody = z.object({ note: z.string().trim().max(500).optional() });

const CreatePostBody = z.object({
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers and hyphens only'),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(20000),
});

// Parses input with a Zod schema; a ZodError becomes a 400 in the error handler.
function parseParams(schema, req) {
  return schema.parse(req.params);
}

function parseBody(schema, req) {
  return schema.parse(req.body ?? {});
}

module.exports = { IdParams, CheckBody, ReviewBody, CreatePostBody, parseParams, parseBody };
