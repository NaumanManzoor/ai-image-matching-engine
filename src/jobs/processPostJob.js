const config = require('../config');
const { boss } = require('./boss');
const posts = require('../repositories/postRepository');
const embeddings = require('../repositories/embeddingRepository');
const { analyzePost } = require('../services/postAnalysisService');
const { embedTexts, postTexts } = require('../services/embeddingService');

const QUEUE = 'process-post';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function register() {
  await boss.createQueue(QUEUE, { policy: 'stately', retryLimit: 3, retryDelay: 20, retryBackoff: true });

  // Two steps per post: (1) extract subject + category, (2) embed content + subject.
  // Each step is skipped if already done, so a retry never repeats a finished AI call.
  await boss.work(QUEUE, { batchSize: 1, localConcurrency: 1, includeMetadata: true }, async ([job]) => {
    let post = await posts.findById(job.data.postId);
    if (!post) return;

    try {
      if (post.status !== 'analyzed') {
        await posts.saveAnalysis(post.id, await analyzePost(post));
        post = await posts.findById(post.id);
        console.log(`[process-post] #${post.id} ${post.slug} -> ${post.subject} (${post.category})`);
      }
      if (!(await embeddings.findForOwner('post', post.id, config.EMBED_MODEL))) {
        const texts = postTexts(post);
        const [content, subject] = await embedTexts([texts.content, texts.subject],
          { ownerType: 'post', ownerId: post.id });
        await embeddings.upsert('post', post.id, 'content', config.EMBED_MODEL, content);
        await embeddings.upsert('post', post.id, 'subject', config.EMBED_MODEL, subject);
        console.log(`[process-post] #${post.id} ${post.slug} embedded`);
      }
    } catch (err) {
      console.warn(`[process-post] #${post.id} attempt ${job.retryCount + 1}/${job.retryLimit + 1} failed: ${err.message}`);
      if (job.retryCount >= job.retryLimit) {
        await posts.markFailed(post.id);
        console.error(`ALERT: post #${post.id} (${post.slug}) failed permanently: ${err.message}`);
      }
      throw err;
    } finally {
      await sleep(config.VISION_DELAY_MS);
    }
  });
}

async function enqueue(postId) {
  return boss.send(QUEUE, { postId }, { singletonKey: `post-${postId}` });
}

async function enqueueAll() {
  const todo = await posts.findNeedingProcessing(config.EMBED_MODEL);
  let queued = 0;
  for (const { id } of todo) if (await enqueue(id)) queued += 1;
  return { queued, alreadyQueued: todo.length - queued };
}

module.exports = { register, enqueue, enqueueAll, QUEUE };