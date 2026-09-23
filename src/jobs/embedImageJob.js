const config = require('../config');
const { boss } = require('./boss');
const images = require('../repositories/imageRepository');
const embeddings = require('../repositories/embeddingRepository');
const { embedTexts, imageTexts } = require('../services/embeddingService');

const QUEUE = 'embed-image';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function register() {
  await boss.createQueue(QUEUE, { policy: 'stately', retryLimit: 3, retryDelay: 20, retryBackoff: true });

  await boss.work(QUEUE, { batchSize: 1, localConcurrency: 1, includeMetadata: true }, async ([job]) => {
    const image = await images.findById(job.data.imageId);
    if (!image || !['tagged', 'flagged'].includes(image.status)) return;

    // Idempotent: skip if this image already has both vectors for the current model.
    if (await embeddings.findForOwner('image', image.id, config.EMBED_MODEL)) return;

    try {
      const texts = imageTexts(image);
      const [content, subject] = await embedTexts([texts.content, texts.subject],
        { ownerType: 'image', ownerId: image.id });
      await embeddings.upsert('image', image.id, 'content', config.EMBED_MODEL, content);
      await embeddings.upsert('image', image.id, 'subject', config.EMBED_MODEL, subject);
      console.log(`[embed-image] #${image.id} ${image.filename} embedded (${content.length} dims)`);
    } catch (err) {
      console.warn(`[embed-image] #${image.id} attempt ${job.retryCount + 1}/${job.retryLimit + 1} failed: ${err.message}`);
      if (job.retryCount >= job.retryLimit) {
        console.error(`ALERT: embedding for image #${image.id} (${image.filename}) failed permanently: ${err.message}`);
      }
      throw err;
    } finally {
      await sleep(config.EMBED_DELAY_MS);
    }
  });
}

async function enqueue(imageId) {
  return boss.send(QUEUE, { imageId }, { singletonKey: `embed-image-${imageId}` });
}

async function enqueueAll() {
  const todo = await images.findNeedingEmbeddings(config.EMBED_MODEL);
  let queued = 0;
  for (const { id } of todo) if (await enqueue(id)) queued += 1;
  return { queued, alreadyQueued: todo.length - queued };
}

module.exports = { register, enqueue, enqueueAll, QUEUE };