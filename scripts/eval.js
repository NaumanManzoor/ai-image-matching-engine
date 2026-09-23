// Evaluation: measures top-1 precision of the full pipeline (ranking + mismatch guard)
// against the hand-labelled set in eval/labels.json.
// Usage: npm run eval
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');
const posts = require('../src/repositories/postRepository');
const { suggestImages } = require('../src/services/matchingService');

async function main() {
  const { labels } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eval', 'labels.json'), 'utf8'));
  const allPosts = await posts.findAll();
  const rows = [];
  let correct = 0;

  for (const label of labels) {
    const post = allPosts.find((p) => p.slug === label.post);
    if (!post) {
      rows.push({ post: label.post, expected: '-', got: 'POST NOT FOUND', correct: 'NO' });
      continue;
    }
    const result = await suggestImages(post.id);
    const got = result.suggestion ? result.suggestion.filename : 'no confident match';
    const expectsNoMatch = label.accept.length === 0;
    const isCorrect = expectsNoMatch
      ? result.suggestion === null
      : result.suggestion !== null && label.accept.some((prefix) => got.startsWith(prefix));

    if (isCorrect) correct += 1;
    rows.push({
      post: label.post,
      expected: expectsNoMatch ? 'no confident match' : label.accept.map((p) => `${p}*`).join(', '),
      got,
      correct: isCorrect ? 'yes' : 'NO',
    });
  }

  console.table(rows);
  const precision = ((correct / labels.length) * 100).toFixed(1);
  console.log(`\nTop-1 precision: ${correct}/${labels.length} = ${precision}%`);
}

main()
  .catch((err) => { console.error('eval failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());