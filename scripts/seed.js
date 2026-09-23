require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../src/db/pool');

const CORPUS = path.join(__dirname, '..', 'corpus');
const POSTS_FILE = path.join(__dirname, 'posts.json');

async function seedImages() {
  const files = fs.readdirSync(CORPUS).filter((f) => f.toLowerCase().endsWith('.jpg'));
  let added = 0;
  for (const file of files) {
    const buffer = fs.readFileSync(path.join(CORPUS, file));
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const result = await pool.query(
      'INSERT INTO images (filename, sha256) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [file, sha256]
    );
    added += result.rowCount;
  }
  console.log(`images: ${added} added, ${files.length - added} already present`);
}

async function seedPosts() {
  const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
  let added = 0;
  for (const post of posts) {
    const result = await pool.query(
      'INSERT INTO posts (slug, title, body) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
      [post.slug, post.title, post.body]
    );
    added += result.rowCount;
  }
  console.log(`posts:  ${added} added, ${posts.length - added} already present`);
}

async function main() {
  await seedImages();
  await seedPosts();
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});