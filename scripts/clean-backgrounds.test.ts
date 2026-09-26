import sharp from "sharp";
import { describe, expect, it } from "vitest";

const SIZE = 800;
const RAW = "src/assets/craft-raw.jpg";
const DIR = "src/assets/clean";
const CUTOUT = `${DIR}/pot-cutout.png`;
const COMPOSITES = ["pot-studio.webp", "pot-linen.webp", "pot-indigo.webp"];
const ALL = [
  "pot-cutout.png",
  "pot-mask.png",
  "bg-studio.jpg",
  "bg-linen.jpg",
  "bg-indigo.jpg",
  ...COMPOSITES,
];

const rgbOf = async (path: string) => sharp(path).removeAlpha().raw().toBuffer();
const alphaOf = async (path: string) =>
  sharp(path).ensureAlpha().extractChannel(3).raw().toBuffer();

describe("cleaned pot images", () => {
  it.each(ALL)("%s is 800×800", async (name) => {
    const { width, height } = await sharp(`${DIR}/${name}`).metadata();
    expect([width, height]).toEqual([SIZE, SIZE]);
  });

  it("the matte covers the pot and not the whole workshop", async () => {
    const alpha = await alphaOf(CUTOUT);
    const opaque = alpha.filter((a) => a === 255).length / (SIZE * SIZE);
    expect(opaque).toBeGreaterThan(0.05);
    expect(opaque).toBeLessThan(0.25);
  });

  it.each(["pot-cutout.png", ...COMPOSITES])(
    "%s keeps every product pixel identical to the raw photo",
    async (name) => {
      const [raw, alpha, out] = await Promise.all([
        rgbOf(RAW),
        alphaOf(CUTOUT),
        rgbOf(`${DIR}/${name}`),
      ]);
      let checked = 0;
      let changed = 0;
      for (let p = 0; p < SIZE * SIZE; p++) {
        if (alpha[p] !== 255) continue;
        checked += 1;
        const i = p * 3;
        if (out[i] !== raw[i] || out[i + 1] !== raw[i + 1] || out[i + 2] !== raw[i + 2]) {
          changed += 1;
        }
      }
      expect(checked).toBeGreaterThan(0);
      expect(changed).toBe(0);
    },
  );
});
