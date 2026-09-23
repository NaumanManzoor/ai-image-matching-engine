const images = require('../repositories/imageRepository');
const { IdParams, parseParams } = require('../routes/validate');

async function list(req, res) {
  res.json(await images.findAll());
}

async function getOne(req, res) {
  const { id } = parseParams(IdParams, req);
  const image = await images.findById(id);
  if (!image) return res.status(404).json({ error: `Image ${id} not found` });
  res.json(image);
}

module.exports = { list, getOne };