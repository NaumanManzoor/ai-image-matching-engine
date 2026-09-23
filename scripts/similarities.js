// Threshold tuning helper: prints, for every post, how similar each image is.
// Use the numbers to choose MATCH_THRESHOLD and SUBJECT_THRESHOLD (record them in BUILDLOG.md).
// Usage: npm run similarities            (top 8 per post)
//        npm run similarities -- 54      (all images)
const config = require('../src/config');
const { pool } = require('../src/db/pool');
const posts = require('../src/repositories/postRepository');
const images = require('../src/repositories/imageRepository');
const embeddings = require('../src/repositories/embeddingRepository');
const { rankImages } = require('../src/services/rankingService');

// Which image filename prefix is the "right" answer for each post (null = no right image).
const EXPECTED = {
  'red-fox-behavior': 'fox', 'vulpes-vulpes-diet': 'fox',
  'gray-wolf-pack-life': 'wolf', 'canis-lupus-howling': 'wolf',
  'dog-training-basics': 'dog', 'choosing-a-family-dog': 'dog',
  'brown-bear-hibernation': 'bear', 'grizzly-salmon-run': 'bear',
  'how-deer-grow-antlers': 'deer', 'spotting-fawns-in-spring': 'deer',
  'pet-goldfish-care': null, 'mountain-bike-trail-tips': null,
};

const f = (n) => n.toFixed(3);

async function main() {
  const limit = Number(process.argv[2] || 8);
  const allImages = (await images.findEmbeddable()).filter((i) => !i.flagged);
  const imageVectors = await embeddings.findAllForType('image', config.EMBED_MODEL);
  const summary = [];

  for (const post of await posts.findAll()) {
    const vectors = await embeddings.findForOwner('post', post.id, config.EMBED_MODEL);
    if (!vectors) { console.log(`#${post.id} ${post.slug}: not embedded yet`); continue; }
    const ranked = rankImages(vectors, allImages, imageVectors);
    const expected = EXPECTED[post.slug];
    const isRight = (r) => expected && r.image.filename.startsWith(`${expected}_`);

    console.log(`\n#${post.id} ${post.slug}  (subject: ${post.subject}, expected: ${expected || 'no match'})`);
    console.log('   content  subject  image');
    for (const r of ranked.slice(0, limit)) {
      console.log(`   ${f(r.similarity)}    ${f(r.subjectSimilarity)}  ${isRight(r) ? '✓' : '✗'} ${r.image.filename} (${r.image.subject})`);
    }

    const right = ranked.filter(isRight);
    const wrong = ranked.filter((r) => !isRight(r));
    summary.push({
      post: post.slug,
      bestRightContent: right.length ? f(Math.max(...right.map((r) => r.similarity))) : '-',
      bestWrongContent: f(Math.max(...wrong.map((r) => r.similarity))),
      minRightSubject: right.length ? f(Math.min(...right.map((r) => r.subjectSimilarity))) : '-',
      maxWrongSubject: f(Math.max(...wrong.map((r) => r.subjectSimilarity))),
      top1Correct: expected ? isRight(ranked[0]) : '-',
    });
  }

  console.log('\nSUMMARY (right = correct animal, wrong = everything else)');
  console.table(summary);
}

main()
  .catch((err) => { console.error('similarities failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());