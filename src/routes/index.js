const express = require('express');
const jobs = require('../controllers/jobsController');
const imagesCtl = require('../controllers/imagesController');
const postsCtl = require('../controllers/postsController');
const costs = require('../controllers/costsController');

const router = express.Router();

router.post('/jobs/ingest-images', jobs.ingestImages);
router.post('/jobs/ingest-posts', jobs.ingestPosts);
router.get('/jobs/status', jobs.status);

router.get('/images', imagesCtl.list);
router.get('/images/:id', imagesCtl.getOne);

router.get('/posts', postsCtl.list);
router.post('/posts', postsCtl.create);
router.get('/posts/:id', postsCtl.getOne);
router.get('/posts/:id/images', postsCtl.suggestImages);
router.post('/posts/:id/check', postsCtl.checkImage);

router.get('/costs', costs.getCosts);

module.exports = router;