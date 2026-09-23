const suggestions = require('../repositories/suggestionRepository');
const reviews = require('../repositories/reviewRepository');
const { IdParams, ReviewBody, parseParams, parseBody } = require('../routes/validate');

function toExplanation(row) {
  return {
    id: row.id,
    decision: row.decision,
    rank: row.rank,
    scores: { similarity: row.similarity, subjectSimilarity: row.subject_similarity },
    reasons: row.reasons,
    post: { id: row.post_id, slug: row.post_slug, title: row.post_title,
            subject: row.post_subject, category: row.post_category },
    image: { id: row.image_id, filename: row.filename, subject: row.image_subject,
             category: row.image_category, attributes: row.attributes, caption: row.caption,
             confidence: row.confidence, flagged: row.flagged },
    review: row.review_action
      ? { action: row.review_action, note: row.review_note, reviewedAt: row.reviewed_at }
      : null,
  };
}

// GET /suggestions/:id — inspect WHY an image was selected or refused.
async function getOne(req, res) {
  const { id } = parseParams(IdParams, req);
  const row = await suggestions.findDetailedById(id);
  if (!row) return res.status(404).json({ error: `Suggestion ${id} not found` });
  res.json(toExplanation(row));
}

// POST /suggestions/:id/approve and /reject — a human decision, recorded once.

const PAST = { approve: 'approved', reject: 'rejected' };
function review(action) {
  return async (req, res) => {
    const { id } = parseParams(IdParams, req);
    const { note } = parseBody(ReviewBody, req);
    const row = await suggestions.findDetailedById(id);
    if (!row) return res.status(404).json({ error: `Suggestion ${id} not found` });

    const { review: saved, created } = await reviews.createOnce(id, action, note);
    if (!created && saved.action !== action) {
      return res.status(409).json({
        error: `Suggestion ${id} was already ${PAST[saved.action]}; a review cannot be changed`,
        review: saved,
      });
    }
    res.status(created ? 201 : 200).json({
      message: created ? `Suggestion ${id} ${PAST[action]}` : `Suggestion ${id} was already ${PAST[action]} (no change)`,
      review: saved,
    });
  };
}

module.exports = { getOne, approve: review('approve'), reject: review('reject') };