// The mismatch guard: decides whether a candidate image is good enough for a post.
// Pure function (no database, no HTTP) so it is easy to test and to explain.
// Every failed rule adds a human-readable reason; the image is accepted only if none fail.

const round = (n) => Math.round(n * 100) / 100;

function subjectMentioned(postSubject, image) {
  const text = `${image.subject} ${image.caption} ${image.attributes.join(' ')}`.toLowerCase();
  return new RegExp(`\\b${postSubject.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`).test(text);
}

function checkMatch({ post, image, similarity, subjectSimilarity, config }) {
  const reasons = [];
  const passed = [];

  // Rule 1: never trust an uncertain classification.
  if (image.flagged) {
    reasons.push(`Image classification uncertain (confidence ${image.confidence} < ${config.CONFIDENCE_MIN})`);
  } else {
    passed.push(`Confident classification (${image.confidence})`);
  }

  // Rule 2: broad category must match (animal vs object vs landscape...).
  if (post.category !== image.category) {
    reasons.push(`Category mismatch: expected ${post.category}, detected ${image.category}`);
  } else {
    passed.push(`Category matches (${image.category})`);
  }

  // Rule 3: the subject must match. Either the subjects are semantically close,
  // or the post's subject is named in the image description (e.g. post "dog", image "husky ... dog").
  const mentioned = subjectMentioned(post.subject, image);
  if (subjectSimilarity >= config.SUBJECT_THRESHOLD || mentioned) {
    passed.push(mentioned
      ? `Subject "${post.subject}" appears in the image description`
      : `Subject similarity ${round(subjectSimilarity)} >= ${config.SUBJECT_THRESHOLD}`);
  } else {
    reasons.push(`Subject mismatch: expected ${post.subject}, detected ${image.subject} ` +
      `(subject similarity ${round(subjectSimilarity)} < ${config.SUBJECT_THRESHOLD})`);
  }

  // Rule 4: overall content must be similar enough.
  if (similarity >= config.MATCH_THRESHOLD) {
    passed.push(`Content similarity ${round(similarity)} >= ${config.MATCH_THRESHOLD}`);
  } else {
    reasons.push(`Content similarity ${round(similarity)} below threshold ${config.MATCH_THRESHOLD}`);
  }

  return { accepted: reasons.length === 0, reasons, passed };
}

module.exports = { checkMatch };