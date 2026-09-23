const { z } = require('zod');

const IdParams = z.object({ id: z.coerce.number().int().positive() });

// Parses req.params with a Zod schema; a ZodError becomes a 400 in the error handler.
function parseParams(schema, req) {
  return schema.parse(req.params);
}

module.exports = { IdParams, parseParams };