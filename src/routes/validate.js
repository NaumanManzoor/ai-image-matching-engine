const { z } = require('zod');

const IdParams = z.object({ id: z.coerce.number().int().positive() });

const CheckBody = z.object({ imageId: z.coerce.number().int().positive() });

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
