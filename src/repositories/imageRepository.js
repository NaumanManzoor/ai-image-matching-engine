const { pool } = require('../db/pool');

const COLUMNS = `id, filename, status, subject, category, attributes, caption,
                 confidence, flagged, error, updated_at`;

async function findAll() {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM images ORDER BY id`);
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM images WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findByFilename(filename) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM images WHERE filename = $1`, [filename]);
  return rows[0] || null;
}

async function findNeedingTags() {
  const { rows } = await pool.query(
    `SELECT id, filename FROM images WHERE status IN ('pending', 'failed') ORDER BY id`
  );
  return rows;
}

async function saveTags(id, tags, flagged) {
  await pool.query(
    `UPDATE images
        SET subject = $2, category = $3, attributes = $4, caption = $5, confidence = $6,
            flagged = $7, status = $8, error = NULL, updated_at = now()
      WHERE id = $1`,
    [id, tags.subject, tags.category, tags.attributes, tags.caption, tags.confidence,
     flagged, flagged ? 'flagged' : 'tagged']
  );
}

async function markFailed(id, message) {
  await pool.query(
    `UPDATE images SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`,
    [id, String(message).slice(0, 500)]
  );
}

async function countByStatus() {
  const { rows } = await pool.query(
    `SELECT status, count(*)::int AS n FROM images GROUP BY status`
  );
  const counts = { pending: 0, tagged: 0, flagged: 0, failed: 0 };
  for (const r of rows) counts[r.status] = r.n;
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
  return counts;
}

async function findEmbeddable() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM images WHERE status IN ('tagged', 'flagged') ORDER BY id`
  );
  return rows;
}

// Tagged/flagged images that do not yet have both embeddings for the current model.
async function findNeedingEmbeddings(model) {
  const { rows } = await pool.query(
    `SELECT i.id FROM images i
      WHERE i.status IN ('tagged', 'flagged')
        AND (SELECT count(*) FROM embeddings e
              WHERE e.owner_type = 'image' AND e.owner_id = i.id AND e.model = $1) < 2
      ORDER BY i.id`,
    [model]
  );
  return rows;
}

module.exports = { findEmbeddable, findNeedingEmbeddings, findAll, findById, findByFilename, findNeedingTags, saveTags, markFailed, countByStatus };