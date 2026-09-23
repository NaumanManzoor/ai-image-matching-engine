// Creates 3 deliberately hard test images from existing corpus photos,
// so we can prove that low-confidence classifications get flagged.
//   hard_04: very dark + heavy blur       (night / out of focus)
//   hard_05: tiny, pixelated + thick fog  (far away in fog)
//   hard_06: black silhouette on orange   (sunset silhouette)
const path = require('path');
const sharp = require('sharp');

const RAW = path.join(__dirname, '..', 'corpus', 'raw');
const src = (name) => path.join(RAW, name);
const out = (name) => path.join(RAW, name);

async function darkBlur(input, output) {
  await sharp(src(input))
    .resize({ width: 512 })
    .blur(18)
    .modulate({ brightness: 0.3 })
    .jpeg({ quality: 80 })
    .toFile(out(output));
}

async function farInFog(input, output) {
  // Shrink to 40px and scale back up: the animal becomes a few blurry pixels.
  const pixelated = await sharp(src(input))
    .resize({ width: 40 })
    .toBuffer()
    .then((small) => sharp(small).resize({ width: 512, kernel: 'nearest' }).toBuffer({ resolveWithObject: true }));
  const { width, height } = pixelated.info;
  const fog = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="white" fill-opacity="0.7"/></svg>`
  );
  await sharp(pixelated.data)
    .composite([{ input: fog }])
    .blur(4)
    .jpeg({ quality: 80 })
    .toFile(out(output));
}

async function silhouette(input, output) {
  await sharp(src(input))
    .resize({ width: 512 })
    .grayscale()
    .threshold(110)
    .tint({ r: 255, g: 120, b: 30 })
    .jpeg({ quality: 80 })
    .toFile(out(output));
}

async function main() {
  await darkBlur('wolf_05.jpg', 'hard_04.jpg');
  await farInFog('fox_04.jpg', 'hard_05.jpg');
  await silhouette('dog_02.jpg', 'hard_06.jpg');
  console.log('Created hard_04.jpg, hard_05.jpg, hard_06.jpg in corpus/raw');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});