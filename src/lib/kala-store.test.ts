import { describe, expect, it } from "vitest";

import { DEMO_DRAFT_ID, getStaticProduct } from "./kala-store";

describe("getStaticProduct", () => {
  it("finds seed products by id", () => {
    expect(getStaticProduct("p2")?.title).toBe("Indigo Ikat Handloom Shawl");
  });

  it("finds the Studio's demo listing so /p/p4 works after a reload", () => {
    expect(getStaticProduct(DEMO_DRAFT_ID)?.certId).toBe("HS-2026-0042");
  });

  it("returns undefined for unknown ids", () => {
    expect(getStaticProduct("nope")).toBeUndefined();
  });

  it("gives every product a unique certificate number", () => {
    const ids = ["p1", "p2", "p3", "p4"].map((id) => getStaticProduct(id)?.certId);
    expect(new Set(ids).size).toBe(4);
  });
});
