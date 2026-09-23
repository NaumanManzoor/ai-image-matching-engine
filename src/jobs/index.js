const { boss } = require('./boss');
const tagImageJob = require('./tagImageJob');
const embedImageJob = require('./embedImageJob');
const processPostJob = require('./processPostJob');

async function startJobs() {
  await boss.start();
  await tagImageJob.register();
  await embedImageJob.register();
  await processPostJob.register();
  console.log('Background workers started');
}

module.exports = { startJobs };