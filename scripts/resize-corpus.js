const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAW = path.join(__dirname, '..', 'corpus', 'raw');
const OUT = path.join(__dirname, '..', 'corpus');
const EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

async function main() {
  const files = fs.readdirSync(RAW).filter((f) => EXTS.includes(path.extname(f).toLowerCase()));
  let total = 0;

  for (const file of files) {
    const name = path.parse(file).name.toLowerCase() + '.jpg';
    const outPath = path.join(OUT, name);
    await sharp(path.join(RAW, file))
      .rotate()
      .resize({ width: 512, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(outPath);
    const size = fs.statSync(outPath).size;
    total += size;
    console.log(`${name.padEnd(16)} ${(size / 1024).toFixed(0)} KB`);
  }

  console.log(`\n${files.length} images, total ${(total / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((err) => {
  console.error('Resize failed:', err.message);
  process.exit(1);
});