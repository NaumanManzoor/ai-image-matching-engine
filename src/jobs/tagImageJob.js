const config = require('../config');
const { boss } = require('./boss');
const images = require('../repositories/imageRepository');
const { tagImage } = require('../services/visionService');
const embedImageJob = require('./embedImageJob');

const QUEUE = 'tag-image';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function register() {
  await boss.createQueue(QUEUE, {
    policy: 'stately',   // with singletonKey: at most one queued + one active job per image
    retryLimit: 3,
    retryDelay: 20,      // seconds; doubles each retry (backoff)
    retryBackoff: true,
  });

  // localConcurrency 1 = one image at a time, to respect the Gemini free-tier rate limit.
  await boss.work(QUEUE, { batchSize: 1, localConcurrency: 1, includeMetadata: true }, async ([job]) => {
    const { imageId } = job.data;
    const image = await images.findById(imageId);

    // Idempotent: an image that is already done is never re-tagged (no duplicate AI cost).
    if (!image || image.status === 'tagged' || image.status === 'flagged') return;

    try {
      const { tags, flagged } = await tagImage(image);
      await images.saveTags(image.id, tags, flagged);
      console.log(`[tag-image] #${image.id} ${image.filename} -> ${tags.subject} ` +
        `(${tags.confidence})${flagged ? ' FLAGGED' : ''}`);
      await embedImageJob.enqueue(image.id); // next step: embeddings
    } catch (err) {
      const isLastAttempt = job.retryCount >= job.retryLimit;
      console.warn(`[tag-image] #${image.id} attempt ${job.retryCount + 1}/${job.retryLimit + 1} failed: ${err.message}`);
      if (isLastAttempt) {
        await images.markFailed(image.id, err.message);
        console.error(`ALERT: image #${image.id} (${image.filename}) failed permanently: ${err.message}`);
      }
      throw err; // tells pg-boss the job failed, so it schedules a retry
    } finally {
      await sleep(config.VISION_DELAY_MS);
    }
  });
}

async function enqueueAll() {
  const todo = await images.findNeedingTags();
  let queued = 0;
  for (const image of todo) {
    const id = await boss.send(QUEUE, { imageId: image.id }, { singletonKey: `image-${image.id}` });
    if (id) queued += 1; // null = already queued, skipped
  }
  return { queued, alreadyQueuedOrDone: todo.length - queued };
}

module.exports = { register, enqueueAll, QUEUE };