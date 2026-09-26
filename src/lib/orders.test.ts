import { describe, expect, it } from "vitest";

import { advanceStep, payoutTotals, type Order } from "./orders";

const base: Order[] = [
  { id: "A", productId: "p1", buyer: "b", location: "l", payout: 1000, step: 0 },
  { id: "B", productId: "p2", buyer: "b", location: "l", payout: 2500, step: 2 },
  { id: "C", productId: "p3", buyer: "b", location: "l", payout: 400, step: 3 },
];

describe("advanceStep", () => {
  it("moves the chosen order forward by exactly one step", () => {
    expect(advanceStep(base, "A").find((o) => o.id === "A")?.step).toBe(1);
  });

  it("never goes past handover", () => {
    expect(advanceStep(base, "C").find((o) => o.id === "C")?.step).toBe(3);
  });

  it("leaves other orders untouched and does not mutate the input", () => {
    const next = advanceStep(base, "A");
    expect(next[1]).toBe(base[1]);
    expect(base[0]!.step).toBe(0);
  });

  it("ignores unknown ids", () => {
    expect(advanceStep(base, "nope")).toEqual(base);
  });
});

describe("payoutTotals", () => {
  it("splits pending and paid by handover", () => {
    expect(payoutTotals(base)).toEqual({ pending: 3500, paid: 400 });
  });

  it("moves a payout to paid when its order is handed over", () => {
    expect(payoutTotals(advanceStep(base, "B"))).toEqual({ pending: 1000, paid: 2900 });
  });
});
