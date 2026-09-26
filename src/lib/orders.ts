export type OrderStep = 0 | 1 | 2 | 3;

export type Order = {
  id: string;
  productId: string;
  buyer: string;
  location: string;
  payout: number;
  step: OrderStep;
};

/** 0 = not packed, 1 = packed, 2 = labelled, 3 = handed to courier (paid out). */
export const FINAL_STEP: OrderStep = 3;

export function advanceStep(orders: Order[], id: string): Order[] {
  return orders.map((o) =>
    o.id === id && o.step < FINAL_STEP ? { ...o, step: (o.step + 1) as OrderStep } : o,
  );
}

export function payoutTotals(orders: Order[]): { pending: number; paid: number } {
  let pending = 0;
  let paid = 0;
  for (const o of orders) {
    if (o.step === FINAL_STEP) paid += o.payout;
    else pending += o.payout;
  }
  return { pending, paid };
}
