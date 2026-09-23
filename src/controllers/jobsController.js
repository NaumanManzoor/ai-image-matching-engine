const config = require('../config');
const tagImageJob = require('../jobs/tagImageJob');
const embedImageJob = require('../jobs/embedImageJob');
const processPostJob = require('../jobs/processPostJob');
const images = require('../repositories/imageRepository');
const posts = require('../repositories/postRepository');
const embeddings = require('../repositories/embeddingRepository');

async function ingestImages(req, res) {
  const tagging = await tagImageJob.enqueueAll();
  const embedding = await embedImageJob.enqueueAll();
  res.status(202).json({ message: 'Image jobs enqueued', tagging, embedding });
}

async function ingestPosts(req, res) {
  const result = await processPostJob.enqueueAll();
  res.status(202).json({ message: 'Post analysis + embedding jobs enqueued', ...result });
}

async function status(req, res) {
  res.json({
    images: await images.countByStatus(),
    posts: await posts.countByStatus(),
    embedded: await embeddings.countByType(config.EMBED_MODEL),
  });
}

module.exports = { ingestImages, ingestPosts, status };