import { describe, expect, it } from "vitest";

import { staleFiles, type Manifest } from "./manifest";

const manifest = (clips: Manifest["clips"]): Manifest => ({
  provider: "mac",
  unsupported: [],
  clips,
});

describe("staleFiles", () => {
  it("lists files the previous manifest used that the new one no longer references", () => {
    const previous = manifest({ "step.0": { hi: { file: "hi/step.0.m4a", hash: "a" } } });
    const next = manifest({ "step.0": { hi: { file: "hi/step.0.mp3", hash: "b" } } });
    expect(staleFiles(previous, next)).toEqual(["hi/step.0.m4a"]);
  });

  it("keeps files that are still referenced", () => {
    const same = manifest({ "step.0": { hi: { file: "hi/step.0.m4a", hash: "a" } } });
    expect(staleFiles(same, same)).toEqual([]);
  });

  it("includes files for clips or languages that were dropped", () => {
    const previous = manifest({
      "step.0": {
        or: { file: "or/step.0.mp3", hash: "a" },
        hi: { file: "hi/step.0.mp3", hash: "b" },
      },
    });
    const next = manifest({ "step.0": { hi: { file: "hi/step.0.mp3", hash: "b" } } });
    expect(staleFiles(previous, next)).toEqual(["or/step.0.mp3"]);
  });
});
