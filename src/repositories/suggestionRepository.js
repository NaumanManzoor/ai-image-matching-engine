const { pool } = require('../db/pool');

// Insert or update (idempotent: one row per post + image pair).
async function upsert(s) {
  const { rows } = await pool.query(
    `INSERT INTO suggestions (post_id, image_id, rank, similarity, subject_similarity, decision, reasons)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (post_id, image_id) DO UPDATE
       SET rank = EXCLUDED.rank, similarity = EXCLUDED.similarity,
           subject_similarity = EXCLUDED.subject_similarity, decision = EXCLUDED.decision,
           reasons = EXCLUDED.reasons, updated_at = now()
     RETURNING id`,
    [s.postId, s.imageId, s.rank, s.similarity, s.subjectSimilarity, s.decision, JSON.stringify(s.reasons)]
  );
  return rows[0].id;
}

module.exports = { upsert };