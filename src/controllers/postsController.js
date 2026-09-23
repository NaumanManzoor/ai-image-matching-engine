const posts = require('../repositories/postRepository');
const processPostJob = require('../jobs/processPostJob');
const matching = require('../services/matchingService');
const { IdParams, CheckBody, CreatePostBody, parseParams, parseBody } = require('../routes/validate');

async function list(req, res) {
  res.json(await posts.findAll());
}

async function getOne(req, res) {
  const { id } = parseParams(IdParams, req);
  const post = await posts.findById(id);
  if (!post) return res.status(404).json({ error: `Post ${id} not found` });
  res.json(post);
}

async function create(req, res) {
  const input = parseBody(CreatePostBody, req);
  const post = await posts.create(input);
  if (!post) return res.status(409).json({ error: `A post with slug "${input.slug}" already exists` });
  await processPostJob.enqueue(post.id);
  res.status(201).json({ ...post, message: 'Post created; analysis + embedding job enqueued' });
}

async function suggestImages(req, res) {
  const { id } = parseParams(IdParams, req);
  res.json(await matching.suggestImages(id));
}

async function checkImage(req, res) {
  const { id } = parseParams(IdParams, req);
  const { imageId } = parseBody(CheckBody, req);
  res.json(await matching.checkImage(id, imageId));
}

module.exports = { list, getOne, create, suggestImages, checkImage };