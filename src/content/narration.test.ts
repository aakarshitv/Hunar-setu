import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { AudioManifest } from "@/lib/audio";
import { LANGUAGE_CODES } from "@/lib/languages";

import { narration, type ClipId } from "./narration";

const clips = Object.keys(narration) as ClipId[];
const manifest = JSON.parse(
  readFileSync("src/content/audio-manifest.json", "utf8"),
) as AudioManifest;

describe("narration text", () => {
  it("has the 14 clips from the spec", () => {
    expect(clips).toHaveLength(14);
  });

  it.each(clips)("%s has text in every language", (clip) => {
    for (const lang of LANGUAGE_CODES) expect(narration[clip][lang].trim(), lang).not.toBe("");
  });
});

describe("narration audio", () => {
  it("has an audio file for every clip in every supported language", () => {
    if (manifest.unsupported.length > 0) {
      console.warn(
        `No voice for: ${manifest.unsupported.join(", ")} (provider ${manifest.provider})`,
      );
    }
    const missing: string[] = [];
    for (const clip of clips) {
      for (const lang of LANGUAGE_CODES) {
        if (manifest.unsupported.includes(lang)) continue;
        const entry = manifest.clips[clip]?.[lang];
        if (!entry || !existsSync(join("public/audio", entry.file)))
          missing.push(`${lang}/${clip}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
