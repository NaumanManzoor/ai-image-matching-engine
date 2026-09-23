const { pool } = require('../db/pool');

async function upsert(ownerType, ownerId, kind, model, vector) {
  await pool.query(
    `INSERT INTO embeddings (owner_type, owner_id, kind, model, vector)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (owner_type, owner_id, kind, model) DO UPDATE SET vector = EXCLUDED.vector`,
    [ownerType, ownerId, kind, model, vector]
  );
}

// Returns { content, subject } vectors for one owner, or null if either is missing.
async function findForOwner(ownerType, ownerId, model) {
  const { rows } = await pool.query(
    `SELECT kind, vector FROM embeddings WHERE owner_type = $1 AND owner_id = $2 AND model = $3`,
    [ownerType, ownerId, model]
  );
  const vectors = Object.fromEntries(rows.map((r) => [r.kind, r.vector]));
  return vectors.content && vectors.subject ? vectors : null;
}

// Returns Map(ownerId -> { content, subject }) for all owners of a type.
async function findAllForType(ownerType, model) {
  const { rows } = await pool.query(
    `SELECT owner_id, kind, vector FROM embeddings WHERE owner_type = $1 AND model = $2`,
    [ownerType, model]
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.owner_id)) map.set(r.owner_id, {});
    map.get(r.owner_id)[r.kind] = r.vector;
  }
  for (const [id, v] of map) if (!v.content || !v.subject) map.delete(id);
  return map;
}

async function countByType(model) {
  const { rows } = await pool.query(
    `SELECT owner_type, count(DISTINCT owner_id)::int AS n FROM embeddings
      WHERE model = $1 GROUP BY owner_type`,
    [model]
  );
  const counts = { image: 0, post: 0 };
  for (const r of rows) counts[r.owner_type] = r.n;
  return counts;
}

module.exports = { upsert, findForOwner, findAllForType, countByType };