const { pool } = require('../db/pool');

const COLUMNS = 'id, slug, title, body, subject, category, status, created_at';

async function findAll() {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM posts ORDER BY id`);
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM posts WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function create({ slug, title, body }) {
  const { rows } = await pool.query(
    `INSERT INTO posts (slug, title, body) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO NOTHING RETURNING ${COLUMNS}`,
    [slug, title, body]
  );
  return rows[0] || null; // null = slug already exists
}

async function saveAnalysis(id, { subject, category }) {
  await pool.query(
    `UPDATE posts SET subject = $2, category = $3, status = 'analyzed' WHERE id = $1`,
    [id, subject, category]
  );
}

async function markFailed(id) {
  await pool.query(`UPDATE posts SET status = 'failed' WHERE id = $1`, [id]);
}

// Posts that still need analysis or embeddings for the current model.
async function findNeedingProcessing(model) {
  const { rows } = await pool.query(
    `SELECT p.id FROM posts p
      WHERE p.status <> 'analyzed'
         OR (SELECT count(*) FROM embeddings e
              WHERE e.owner_type = 'post' AND e.owner_id = p.id AND e.model = $1) < 2
      ORDER BY p.id`,
    [model]
  );
  return rows;
}

async function countByStatus() {
  const { rows } = await pool.query(`SELECT status, count(*)::int AS n FROM posts GROUP BY status`);
  const counts = { pending: 0, analyzed: 0, failed: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

module.exports = { findAll, findById, create, saveAnalysis, markFailed, findNeedingProcessing, countByStatus };