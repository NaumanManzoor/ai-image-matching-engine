const tagImageJob = require('../jobs/tagImageJob');
const images = require('../repositories/imageRepository');

async function ingestImages(req, res) {
  const result = await tagImageJob.enqueueAll();
  res.status(202).json({ message: 'Image tagging jobs enqueued', ...result });
}

async function status(req, res) {
  res.json({ images: await images.countByStatus() });
}

module.exports = { ingestImages, status };