const { boss } = require('./boss');
const tagImageJob = require('./tagImageJob');

async function startJobs() {
  await boss.start();
  await tagImageJob.register();
  console.log('Background workers started');
}

module.exports = { startJobs };