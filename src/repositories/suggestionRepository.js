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

// One suggestion with everything needed to explain it: post, image tags, scores, reasons, review.
async function findDetailedById(id) {
  const { rows } = await pool.query(
    `SELECT s.id, s.rank, s.similarity, s.subject_similarity, s.decision, s.reasons,
            s.created_at, s.updated_at,
            p.id AS post_id, p.slug AS post_slug, p.title AS post_title,
            p.subject AS post_subject, p.category AS post_category,
            i.id AS image_id, i.filename, i.subject AS image_subject, i.category AS image_category,
            i.attributes, i.caption, i.confidence, i.flagged,
            r.action AS review_action, r.note AS review_note, r.created_at AS reviewed_at
       FROM suggestions s
       JOIN posts p ON p.id = s.post_id
       JOIN images i ON i.id = s.image_id
       LEFT JOIN reviews r ON r.suggestion_id = s.id
      WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { upsert, findDetailedById };