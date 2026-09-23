const { pool } = require('../db/pool');

// Idempotent: the UNIQUE(suggestion_id) constraint means a suggestion can be reviewed once.
// Returns { review, created } — created=false when a review already existed.
async function createOnce(suggestionId, action, note) {
  const inserted = await pool.query(
    `INSERT INTO reviews (suggestion_id, action, note) VALUES ($1, $2, $3)
     ON CONFLICT (suggestion_id) DO NOTHING
     RETURNING id, suggestion_id, action, note, created_at`,
    [suggestionId, action, note ?? null]
  );
  if (inserted.rows[0]) return { review: inserted.rows[0], created: true };

  const existing = await pool.query(
    `SELECT id, suggestion_id, action, note, created_at FROM reviews WHERE suggestion_id = $1`,
    [suggestionId]
  );
  return { review: existing.rows[0], created: false };
}

module.exports = { createOnce };