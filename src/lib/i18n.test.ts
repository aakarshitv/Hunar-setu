import { describe, expect, it } from "vitest";

import { dictionaries, en, interpolate, type TranslationKey } from "./i18n";

// Brand names stay in English on purpose.
const BRAND_KEYS = new Set<string>(["app.name"]);
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe("translations", () => {
  const others = Object.entries(dictionaries).filter(([code]) => code !== "en");

  it.each(others)("%s translates every UI string", (_code, dict) => {
    const missing = Object.keys(en).filter(
      (key) => !BRAND_KEYS.has(key) && !dict[key as TranslationKey],
    );
    expect(missing).toEqual([]);
  });

  it("keeps {placeholders} intact in every language", () => {
    for (const dict of Object.values(dictionaries)) {
      for (const [key, value] of Object.entries(dict)) {
        if (!value) continue;
        expect(placeholders(value), key).toEqual(placeholders(en[key as TranslationKey]));
      }
    }
  });
});

describe("interpolate", () => {
  it("fills named placeholders", () => {
    expect(interpolate("{a} to {b}", { a: "₹1", b: "x@upi" })).toBe("₹1 to x@upi");
  });

  it("leaves unknown placeholders visible", () => {
    expect(interpolate("{a} {z}", { a: 1 })).toBe("1 {z}");
  });
});
