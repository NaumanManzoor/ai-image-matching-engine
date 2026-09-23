const express = require('express');
const jobs = require('../controllers/jobsController');
const imagesCtl = require('../controllers/imagesController');
const costs = require('../controllers/costsController');

const router = express.Router();

router.post('/jobs/ingest-images', jobs.ingestImages);
router.get('/jobs/status', jobs.status);

router.get('/images', imagesCtl.list);
router.get('/images/:id', imagesCtl.getOne);

router.get('/costs', costs.getCosts);

module.exports = router;