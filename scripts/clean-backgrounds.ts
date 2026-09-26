/**
 * Cuts the pot out of the raw workshop photo with an open-source segmentation model
 * and places it on clean backgrounds. Product pixels are copied from the raw photo,
 * never generated; only the background and shadow are synthetic.
 *
 * Usage: node scripts/clean-backgrounds.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { removeBackground } from "@imgly/background-removal-node";
import sharp from "sharp";

const SRC = "src/assets/craft-raw.jpg";
const OUT = "src/assets/clean";
const SIZE = 800;
// Where the artisan framed the product (like tapping it). Keeps the other pots on the
// shelf out of the matte.
const ROI = { left: 250, top: 310, right: 570, bottom: 610 };
const STYLES = ["studio", "linen", "indigo"] as const;
type Style = (typeof STYLES)[number];

mkdirSync(OUT, { recursive: true });
const rawJpeg = readFileSync(SRC);
const { data: rgb, info } = await sharp(rawJpeg)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (info.width !== SIZE || info.height !== SIZE) {
  throw new Error(`Expected ${SIZE}×${SIZE}, got ${info.width}×${info.height}`);
}

// 1. Segmentation → alpha matte.
const foreground = await removeBackground(new Blob([rawJpeg], { type: "image/jpeg" }), {
  model: "medium",
  output: { format: "image/png" },
});
const alpha = await sharp(Buffer.from(await foreground.arrayBuffer()))
  .resize(SIZE, SIZE)
  .ensureAlpha()
  .extractChannel(3)
  .raw()
  .toBuffer();

// 2. Tidy the matte: nothing outside the ROI, snap near-opaque/near-clear values.
let minX = SIZE;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = y * SIZE + x;
    const inRoi = x >= ROI.left && x < ROI.right && y >= ROI.top && y < ROI.bottom;
    const a = inRoi ? alpha[i]! : 0;
    alpha[i] = a >= 240 ? 255 : a <= 15 ? 0 : a;
    if (alpha[i] === 255) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}
if (maxY < 0) throw new Error("Segmentation found no product inside the ROI");

// 3. Cutout (raw RGB + matte) and a white silhouette for the scan animation.
const cutoutRgba = Buffer.alloc(SIZE * SIZE * 4);
const maskRgba = Buffer.alloc(SIZE * SIZE * 4, 255);
for (let p = 0; p < SIZE * SIZE; p++) {
  maskRgba[p * 4 + 3] = alpha[p]!;
  // Fully transparent pixels carry no colour, which keeps the PNG small.
  if (alpha[p] === 0) continue;
  cutoutRgba[p * 4] = rgb[p * 3]!;
  cutoutRgba[p * 4 + 1] = rgb[p * 3 + 1]!;
  cutoutRgba[p * 4 + 2] = rgb[p * 3 + 2]!;
  cutoutRgba[p * 4 + 3] = alpha[p]!;
}
const raw4 = { raw: { width: SIZE, height: SIZE, channels: 4 as const } };
const cutout = await sharp(cutoutRgba, raw4).png().toBuffer();
writeFileSync(`${OUT}/pot-cutout.png`, cutout);
writeFileSync(`${OUT}/pot-mask.png`, await sharp(maskRgba, raw4).png().toBuffer());

// 4. Backgrounds with a soft contact shadow under the pot, then composites.
const cx = Math.round((minX + maxX) / 2);
const shadowRx = Math.round((maxX - minX) * 0.48);

const gradients: Record<Style, string> = {
  studio: `<radialGradient id="g" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6e2dc"/></radialGradient>`,
  linen: `<radialGradient id="g" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#f4ebdc"/><stop offset="1" stop-color="#dccbb0"/></radialGradient>`,
  indigo: `<radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#3a4a94"/><stop offset="1" stop-color="#141b3f"/></radialGradient>`,
};

function backgroundSvg(style: Style) {
  const weave =
    style === "linen"
      ? `<rect width="100%" height="100%" filter="url(#noise)" opacity="0.10"/>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <defs>
    ${gradients[style]}
    <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  ${weave}
  <ellipse cx="${cx}" cy="${maxY - 4}" rx="${shadowRx}" ry="${Math.round(shadowRx * 0.16)}"
    fill="#000" opacity="${style === "indigo" ? 0.55 : 0.32}" filter="url(#blur)"/>
</svg>`;
}

for (const style of STYLES) {
  const bg = await sharp(Buffer.from(backgroundSvg(style)))
    .flatten()
    .jpeg({ quality: 90 })
    .toBuffer();
  writeFileSync(`${OUT}/bg-${style}.jpg`, bg);
  const composite = await sharp(bg)
    .composite([{ input: cutout }])
    .removeAlpha()
    .webp({ lossless: true })
    .toBuffer();
  writeFileSync(`${OUT}/pot-${style}.webp`, composite);
  console.log(`✓ ${style}`);
}
console.log(`Matte box x ${minX}–${maxX}, bottom ${maxY}`);
