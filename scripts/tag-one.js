// Tags ONE image with the real model and prints the result, without saving tags.
// Usage: npm run tag-one -- fox_01.jpg
const { pool } = require('../src/db/pool');
const { tagImage } = require('../src/services/visionService');

async function main() {
  const filename = process.argv[2];
  if (!filename) throw new Error('Give a filename, e.g. npm run tag-one -- fox_01.jpg');
  const { rows } = await pool.query('SELECT id, filename FROM images WHERE filename = $1', [filename]);
  if (!rows[0]) throw new Error(`${filename} is not in the images table (run npm run seed)`);
  const result = await tagImage(rows[0]);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => { console.error('tag-one failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());