'use strict';
/**
 * From the color PNG (blue on white), writes:
 * - insider-lawyers-logo-bw.png (grayscale, for print / light BG)
 * - insider-lawyers-logo-white.png (white on transparent, for dark CTA)
 */
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const inPath = path.join(root, 'assets', 'nursing-home', 'insider-lawyers-logo-color.png');
const outGray = path.join(root, 'assets', 'nursing-home', 'insider-lawyers-logo-bw.png');
const outWhite = path.join(root, 'assets', 'nursing-home', 'insider-lawyers-logo-white.png');

async function toGrayscale() {
  await sharp(inPath).grayscale().png({ compressionLevel: 9 }).toFile(outGray);
  console.log('Wrote', outGray);
}

async function toWhiteOnTransparent() {
  const { data, info } = await sharp(inPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const avg = (r + g + b) / 3;
    // White / near-white background
    if (r > 248 && g > 248 && b > 248) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    // Very light anti-alias near white: fade
    if (avg > 235) {
      const t = 1 - (avg - 235) / 20;
      if (t <= 0) {
        out[i + 3] = 0;
        continue;
      }
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = Math.max(0, Math.min(255, Math.round(255 * t * (a / 255))));
      continue;
    }
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = a;
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outWhite);
  console.log('Wrote', outWhite);
}

async function main() {
  await toGrayscale();
  await toWhiteOnTransparent();
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
