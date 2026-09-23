const config = require('../config');
const posts = require('../repositories/postRepository');
const images = require('../repositories/imageRepository');
const embeddings = require('../repositories/embeddingRepository');
const suggestions = require('../repositories/suggestionRepository');
const { rankImages, cosine } = require('./rankingService');
const { checkMatch } = require('./mismatchGuard');

class NotReadyError extends Error {}
class NotFoundError extends Error {}

const round = (n) => Math.round(n * 1000) / 1000;

async function loadPost(postId) {
  const post = await posts.findById(postId);
  if (!post) throw new NotFoundError(`Post ${postId} not found`);
  const vectors = await embeddings.findForOwner('post', post.id, config.EMBED_MODEL);
  if (post.status !== 'analyzed' || !vectors) {
    throw new NotReadyError(`Post ${postId} is not processed yet; run POST /jobs/ingest-posts`);
  }
  return { post, vectors };
}

function describe(candidate, verdict, rank) {
  return {
    rank,
    imageId: candidate.image.id,
    filename: candidate.image.filename,
    subject: candidate.image.subject,
    caption: candidate.image.caption,
    confidence: candidate.image.confidence,
    similarity: round(candidate.similarity),
    subjectSimilarity: round(candidate.subjectSimilarity),
    decision: verdict.accepted ? 'accepted' : 'rejected',
    reasons: verdict.reasons,
    passed: verdict.passed,
  };
}

// Ranks all images for a post, runs the top K through the mismatch guard,
// saves them as suggestions and returns the best accepted one (or "no confident match").
async function suggestImages(postId) {
  const { post, vectors } = await loadPost(postId);
  const allImages = await images.findEmbeddable();
  const imageVectors = await embeddings.findAllForType('image', config.EMBED_MODEL);
  const ranked = rankImages(vectors, allImages, imageVectors).slice(0, config.TOP_K);

  const candidates = [];
  for (const [i, candidate] of ranked.entries()) {
    const verdict = checkMatch({ post, image: candidate.image, similarity: candidate.similarity,
      subjectSimilarity: candidate.subjectSimilarity, config });
    const result = describe(candidate, verdict, i + 1);
    result.suggestionId = await suggestions.upsert({
      postId: post.id, imageId: candidate.image.id, rank: i + 1,
      similarity: candidate.similarity, subjectSimilarity: candidate.subjectSimilarity,
      decision: result.decision, reasons: verdict.reasons,
    });
    candidates.push(result);
  }

  const best = candidates.find((c) => c.decision === 'accepted') || null;
  return {
    post: { id: post.id, slug: post.slug, title: post.title, subject: post.subject, category: post.category },
    result: best ? 'match' : 'no confident match',
    suggestion: best,
    reasons: best ? [] : candidates.slice(0, 3).map((c) => `${c.filename}: ${c.reasons.join('; ')}`),
    candidates,
    thresholds: {
      MATCH_THRESHOLD: config.MATCH_THRESHOLD,
      SUBJECT_THRESHOLD: config.SUBJECT_THRESHOLD,
      CONFIDENCE_MIN: config.CONFIDENCE_MIN,
    },
  };
}

// Forces ONE specific image through the guard for a post (e.g. the wolf on the fox post).
async function checkImage(postId, { imageId, filename }) {
  const { post, vectors } = await loadPost(postId);
  const image = imageId ? await images.findById(imageId) : await images.findByFilename(filename);
  if (!image) throw new NotFoundError(`Image ${imageId || filename} not found`);
  const imageVectors = await embeddings.findForOwner('image', image.id, config.EMBED_MODEL);
  if (!imageVectors) throw new NotReadyError(`Image ${imageId} is not embedded yet`);

  const candidate = {
    image,
    similarity: cosine(vectors.content, imageVectors.content),
    subjectSimilarity: cosine(vectors.subject, imageVectors.subject),
  };
  const verdict = checkMatch({ post, image, similarity: candidate.similarity,
    subjectSimilarity: candidate.subjectSimilarity, config });
  const result = describe(candidate, verdict, null);
  delete result.rank;
  return {
    post: { id: post.id, title: post.title, subject: post.subject, category: post.category },
    candidate: result,
    result: verdict.accepted ? 'ACCEPTED' : 'REJECTED',
  };
}

module.exports = { suggestImages, checkImage, NotReadyError, NotFoundError };