import { describe, expect, it } from "vitest";

import { productCopy } from "@/content/narration";

import { localize, upsertProduct } from "./products";

describe("upsertProduct", () => {
  const list = [
    { id: "p1", v: 1 },
    { id: "p2", v: 1 },
  ];

  it("adds a new product to the front", () => {
    expect(upsertProduct(list, { id: "p4", v: 1 }).map((p) => p.id)).toEqual(["p4", "p1", "p2"]);
  });

  it("replaces an existing product in place instead of duplicating it", () => {
    const next = upsertProduct(list, { id: "p2", v: 2 });
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ id: "p2", v: 2 });
  });
});

describe("localize", () => {
  it("returns the product's title and story in the chosen language", () => {
    expect(localize({ id: "p2", title: "x", story: "y" }, "hi")).toEqual(productCopy.p2.hi);
  });

  it("falls back to the product's own text for products without translations", () => {
    expect(localize({ id: "zz", title: "Own", story: "Text" }, "ta")).toEqual({
      title: "Own",
      story: "Text",
    });
  });
});
