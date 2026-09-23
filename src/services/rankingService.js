function cosine(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Scores every image against a post and returns them sorted, best first.
// postVectors = { content, subject }; imageVectors = Map(imageId -> { content, subject })
function rankImages(postVectors, images, imageVectors) {
  const scored = [];
  for (const image of images) {
    const vectors = imageVectors.get(image.id);
    if (!vectors) continue; // image not embedded yet
    scored.push({
      image,
      similarity: cosine(postVectors.content, vectors.content),
      subjectSimilarity: cosine(postVectors.subject, vectors.subject),
    });
  }
  return scored.sort((a, b) => b.similarity - a.similarity);
}

module.exports = { cosine, rankImages };