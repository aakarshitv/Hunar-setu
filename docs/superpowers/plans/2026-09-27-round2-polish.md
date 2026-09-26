# HunarSetu Round 2 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local-language narration, a background cleanup that never alters the product, a scannable authenticity QR with a verification page, and a working dispatch tracker to the HunarSetu PoC for the SIH Round 2 video.

**Architecture:** Everything stays client-side. Audio and cleaned images are produced once by dev-time Node scripts (`scripts/*.ts`, run with Node 24's built-in TypeScript stripping) and bundled as static assets; the app only plays/shows them. New pure logic (`orders.ts`, `products.ts`, `audio.ts`) is unit-tested with Vitest; UI is verified in the browser at phone size.

**Tech Stack:** TanStack Start + React 19, Tailwind v4, Vitest, `sharp`, `@imgly/background-removal-node`, `qrcode`, Sarvam AI TTS (dev-time only), macOS `say`/`afconvert` (fallback).

**Spec:** `docs/superpowers/specs/2026-09-27-round2-polish-design.md`

## Global Constraints

- Work on branch `round2-polish`; one PR at the end. Package manager is **bun** (`bun.lock`); run scripts with `bun run <script>` and Node scripts with `node`.
- Languages, in this order everywhere: `en, hi, bn, ta, mr, or`.
- No runtime network calls. API keys only in `.env.local` (git-ignored via `*.local`); never committed, never printed.
- Product pixels in cleaned images are copied from `src/assets/craft-raw.jpg`, never generated. Cleaned composites are **lossless WebP**; all cleaned outputs are **800×800**.
- The Studio's new listing always has id **`p4`**; publishing again replaces it.
- tsconfig is strict with `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature` — never pass `undefined` to an optional prop; use bracket access on index signatures.
- Relative imports inside files that the Node scripts load (`src/content/narration.ts`, `src/lib/languages.ts`) must use explicit `.ts` extensions or be `import type`.
- Format new/changed files with `npx prettier --write <files>` before each commit (repo `.prettierrc`).
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Double-tapping the next-action button** — a quick double tap must advance exactly one step (700 ms busy guard). Checked in Task 1 Step 9.
2. **Changing language or screen while a clip plays** — audio stops immediately, no two voices overlap, the button returns to "Listen". Checked in Task 2 Step 14.
3. **Refreshing `/p/p4` or opening `/p/unknown`** — the page renders after a hard reload; an unknown id shows the 404 page. Unit test in Task 4 Step 1, browser check in Task 4 Step 12.
4. **Publishing twice or after switching background style** — exactly one `p4` listing, showing the most recent style. Unit test in Task 2 Step 1, browser check in Task 3 Step 11.
5. **Hard reload of every route (SSR)** — no hydration or `window is not defined` errors from QR, audio or count-up code. Checked in Task 4 Step 12 and Task 6 Step 3.

---

### Task 1: Test setup, dispatch tracker and payouts

**Files:**
- Create: `vitest.config.ts`, `src/lib/languages.ts`, `src/lib/orders.ts`, `src/lib/orders.test.ts`, `src/lib/i18n.test.ts`, `src/hooks/use-count-up.ts`
- Modify: `package.json`, `tsconfig.json`, `vite.config.ts:9`, `src/lib/kala-store.tsx`, `src/lib/i18n.ts`, `src/routes/orders.tsx`, `src/routes/__root.tsx`, `src/components/kala/AppShell.tsx`

**Interfaces:**
- Produces: `LANGUAGES`, `LanguageCode`, `LANGUAGE_CODES: LanguageCode[]`, `SPEECH_TAGS: Record<LanguageCode, string>` (languages.ts); `OrderStep`, `Order`, `FINAL_STEP`, `advanceStep(orders, id): Order[]`, `payoutTotals(orders): { pending: number; paid: number }` (orders.ts); `interpolate(template, vars): string`, exported `en`, `dictionaries` (i18n.ts); `ARTISAN` and context fields `advanceOrder(id: string): void`, `lastTransfer: number` (kala-store); `useCountUp(target, durationMs?)`.

- [ ] **Step 1: Install Vitest and wire it up**

```bash
bun add -d vitest
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Standalone config: the TanStack Start plugin in vite.config.ts is not needed for unit tests.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
```

In `package.json` `scripts`, add `"test": "vitest run"`.

In `tsconfig.json`: change `"include"` to
`["src/**/*.ts", "src/**/*.tsx", "scripts/**/*.ts", "vite.config.ts", "vitest.config.ts", "eslint.config.js"]`
and add `"resolveJsonModule": true` under `compilerOptions`.

In `vite.config.ts` line 9, fix the existing type error:

```ts
process.env["NITRO_COMPATIBILITY_DATE"] ??= "2025-07-13";
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/orders.test.ts`:

```ts
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
```

Create `src/lib/i18n.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test`
Expected: FAIL — `Cannot find module './orders'` and `interpolate`/`dictionaries` not exported.

- [ ] **Step 4: Create `src/lib/languages.ts` and `src/lib/orders.ts`**

`src/lib/languages.ts` (no imports — the Node audio script loads it):

```ts
export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const LANGUAGE_CODES: LanguageCode[] = LANGUAGES.map((l) => l.code);

/** BCP-47 tags for the browser speechSynthesis fallback. */
export const SPEECH_TAGS: Record<LanguageCode, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  mr: "mr-IN",
  or: "or-IN",
};
```

`src/lib/orders.ts`:

```ts
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
```

- [ ] **Step 5: Update `src/lib/i18n.ts`**

1. Replace line 1 with `import type { LanguageCode } from "@/lib/languages";`
2. Change `const en = {` to `export const en = {` and `const dictionaries` to `export const dictionaries`.
3. Append after `translate`:

```ts
export function interpolate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
```

4. In **each** of the six dictionaries, replace the value of the existing `"orders.lastTransfer"` entry, and add the new keys directly after `"orders.hear"`:

`en`:
```ts
  "orders.lastTransfer": "Last transfer {amount} to UPI {upi} · settled in 2 hours",
  "orders.markPacked": "Mark packed",
  "orders.markLabelled": "Mark labelled",
  "orders.handOver": "Hand over to courier",
  "orders.done": "Handed to courier",
  "orders.sentToast": "{amount} sent to UPI {upi}",
```
`hi`:
```ts
  "orders.lastTransfer": "अंतिम भुगतान {amount} यूपीआई {upi} पर · 2 घंटे में निपटा",
  "orders.markPacked": "पैक हो गया",
  "orders.markLabelled": "लेबल लग गया",
  "orders.handOver": "कूरियर को सौंपें",
  "orders.done": "कूरियर को सौंपा",
  "orders.sentToast": "{amount} यूपीआई {upi} पर भेजे गए",
```
`bn`:
```ts
  "orders.lastTransfer": "শেষ স্থানান্তর {amount} ইউপিআই {upi}-তে · ২ ঘণ্টায় নিষ্পন্ন",
  "orders.markPacked": "প্যাক হয়েছে",
  "orders.markLabelled": "লেবেল লাগানো হয়েছে",
  "orders.handOver": "কুরিয়ারকে দিন",
  "orders.done": "কুরিয়ারকে দেওয়া হয়েছে",
  "orders.sentToast": "{amount} ইউপিআই {upi}-তে পাঠানো হয়েছে",
```
`ta`:
```ts
  "orders.lastTransfer": "கடைசி பரிமாற்றம் {amount} யுபிஐ {upi}-க்கு · 2 மணி நேரத்தில் முடிந்தது",
  "orders.markPacked": "பேக் ஆனது",
  "orders.markLabelled": "லேபிள் ஒட்டியது",
  "orders.handOver": "கூரியரிடம் ஒப்படை",
  "orders.done": "கூரியரிடம் ஒப்படைக்கப்பட்டது",
  "orders.sentToast": "{amount} யுபிஐ {upi}-க்கு அனுப்பப்பட்டது",
```
`mr`:
```ts
  "orders.lastTransfer": "शेवटचे हस्तांतरण {amount} यूपीआय {upi} वर · 2 तासांत पूर्ण",
  "orders.markPacked": "पॅक झाले",
  "orders.markLabelled": "लेबल लावले",
  "orders.handOver": "कुरियरकडे सोपवा",
  "orders.done": "कुरियरकडे सोपवले",
  "orders.sentToast": "{amount} यूपीआय {upi} वर पाठवले",
```
`or`:
```ts
  "orders.lastTransfer": "ଶେଷ ସ୍ଥାନାନ୍ତର {amount} ୟୁପିଆଇ {upi}କୁ · 2 ଘଣ୍ଟାରେ ସମାପ୍ତ",
  "orders.markPacked": "ପ୍ୟାକ ହେଲା",
  "orders.markLabelled": "ଲେବଲ ଲାଗିଲା",
  "orders.handOver": "କୁରିଅରକୁ ଦିଅନ୍ତୁ",
  "orders.done": "କୁରିଅରକୁ ଦିଆଗଲା",
  "orders.sentToast": "{amount} ୟୁପିଆଇ {upi}କୁ ପଠାଗଲା",
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun run test`
Expected: PASS (orders: 6 tests, i18n: 7 tests).

- [ ] **Step 7: Make orders stateful in `src/lib/kala-store.tsx`**

1. Delete the local `Order` type and the `LANGUAGES` / `LanguageCode` definitions. Add at the top of the imports:

```ts
import { LANGUAGES, type LanguageCode } from "@/lib/languages";
import { advanceStep, type Order } from "@/lib/orders";
```

and after the imports:

```ts
export { LANGUAGES, type LanguageCode };
export type { Order };

export const ARTISAN = {
  name: "Rekha Devi",
  initials: "RD",
  region: "Kutch, Gujarat",
  upi: "rekha@upi",
} as const;
```

2. In `KalaContextValue` add `lastTransfer: number;` (keep `advanceOrder: (id: string) => void;`).
3. In `KalaProvider` replace `const [orders] = useState<Order[]>(seedOrders);` and the no-op `advanceOrder` with:

```ts
  const [orders, setOrders] = useState<Order[]>(seedOrders);
  // Seed value matches the already-settled order KL-4460.
  const [lastTransfer, setLastTransfer] = useState(4100);

  const advanceOrder = useCallback(
    (id: string) => {
      const order = orders.find((o) => o.id === id);
      if (!order || order.step === 3) return;
      if (order.step === 2) setLastTransfer(order.payout);
      setOrders((prev) => advanceStep(prev, id));
    },
    [orders],
  );
```

4. Add `lastTransfer` to the `value` object and to its `useMemo` dependency list.

- [ ] **Step 8: Tracker UI, count-up and toast**

Create `src/hooks/use-count-up.ts`:

```ts
import { useEffect, useRef, useState } from "react";

/** Animates a displayed number towards `target` with an ease-out curve. */
export function useCountUp(target: number, durationMs = 600) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const from = valueRef.current;
    if (from === target) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const next = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
      valueRef.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
```

In `src/routes/__root.tsx`: change the React import to `import { type ReactNode } from "react";`, add `import { Toaster } from "@/components/ui/sonner";`, and render the toaster inside the provider:

```tsx
      <KalaProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster position="top-center" richColors />
      </KalaProvider>
```

In `src/components/kala/AppShell.tsx` import `ARTISAN` from `@/lib/kala-store` and replace the hard-coded `RD` with `{ARTISAN.initials}`.

Replace `src/routes/orders.tsx` below the `Route` definition (keep the `Route` export and its `head` exactly as they are) and update the imports:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import {
  Banknote,
  Box,
  CheckCircle2,
  MapPin,
  PackageCheck,
  Tag,
  Truck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/kala/AppShell";
import { SpeakButton } from "@/components/kala/shared";
import { useCountUp } from "@/hooks/use-count-up";
import { interpolate, type TranslationKey } from "@/lib/i18n";
import { ARTISAN, rupees, useKala } from "@/lib/kala-store";
import { payoutTotals, type Order } from "@/lib/orders";
import { cn } from "@/lib/utils";

// ... existing `export const Route = createFileRoute("/orders")({ ... })` unchanged ...

const steps = [
  { labelKey: "orders.pack", icon: Box },
  { labelKey: "orders.label", icon: Tag },
  { labelKey: "orders.handover", icon: Truck },
] as const;

const nextActionKey: Record<0 | 1 | 2, TranslationKey> = {
  0: "orders.markPacked",
  1: "orders.markLabelled",
  2: "orders.handOver",
};

// Long enough for the tracker animation; stops a double tap from skipping a step.
const BUSY_MS = 700;

function OrdersPage() {
  const { orders, products, advanceOrder, lastTransfer, t } = useKala();
  const { pending, paid } = payoutTotals(orders);
  const pendingShown = useCountUp(pending);
  const paidShown = useCountUp(paid);
  const [busy, setBusy] = useState(false);

  const onAdvance = (o: Order) => {
    if (busy || o.step === 3) return;
    setBusy(true);
    window.setTimeout(() => setBusy(false), BUSY_MS);
    advanceOrder(o.id);
    if (o.step === 2) {
      toast.success(
        interpolate(t("orders.sentToast"), { amount: rupees(o.payout), upi: ARTISAN.upi }),
      );
    }
  };

  return (
    <AppShell
      title={t("orders.title")}
      subtitle={`${orders.length} ${t("orders.count")} · ${rupees(pending)} ${t("orders.onTheWay")}`}
    >
      <section className="craft-card space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Wallet className="size-4 text-primary" /> {t("orders.payouts")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-accent p-3">
            <p className="text-[11px] font-semibold text-accent-foreground">
              {t("orders.pending")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
              {rupees(pendingShown)}
            </p>
          </div>
          <div className="rounded-xl bg-leaf/15 p-3">
            <p className="text-[11px] font-semibold text-foreground">{t("orders.paid")}</p>
            <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
              {rupees(paidShown)}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Banknote className="size-4 shrink-0 text-leaf" />
          {interpolate(t("orders.lastTransfer"), {
            amount: rupees(lastTransfer),
            upi: ARTISAN.upi,
          })}
        </p>
      </section>

      <section className="space-y-3">
        {orders.map((o) => {
          const product = products.find((p) => p.id === o.productId);
          const instructions = `${o.id} · ${product?.title ?? ""} · ${rupees(o.payout)} · ${t(
            steps[Math.min(o.step, 2)]!.labelKey,
          )}`;
          return (
            <article key={o.id} className="craft-card space-y-3 p-3">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <img
                  src={product?.image}
                  alt={product?.title ?? "Order item"}
                  loading="lazy"
                  width={800}
                  height={800}
                  className="size-16 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{product?.title}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" /> {o.location}
                  </p>
                  <p className="mt-0.5 text-base font-semibold text-primary">
                    {rupees(o.payout)}
                  </p>
                </div>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-leaf transition-[width] duration-500 ease-out"
                  style={{ width: `${(o.step / 3) * 100}%` }}
                />
              </div>

              <div className="flex items-center gap-2">
                {steps.map((s, i) => {
                  const done = o.step > i;
                  const Icon = done ? PackageCheck : s.icon;
                  return (
                    <div
                      key={s.labelKey}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors duration-500",
                        done ? "bg-leaf text-leaf-foreground" : "bg-secondary text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" />
                      {t(s.labelKey)}
                    </div>
                  );
                })}
              </div>

              {o.step === 3 ? (
                <p className="flex items-center justify-center gap-2 rounded-xl bg-leaf/15 py-3 text-sm font-semibold">
                  <CheckCircle2 className="size-4 text-leaf" /> {t("orders.done")}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => onAdvance(o)}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-70"
                >
                  {t(nextActionKey[o.step])}
                </button>
              )}

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  {o.id} · {o.buyer}
                </p>
                <SpeakButton text={instructions} label={t("orders.hear")} />
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
```

- [ ] **Step 9: Verify in the browser (Review Focus 1)**

Run `npx tsc --noEmit` — expected: no errors. Start the dev server (`bun run dev`, or `preview_start` in the desktop app), open `/orders` at 375×812:
- KL-4471 shows "Mark labelled"; tap it → progress bar grows, "Label" cell turns green, button becomes "Hand over to courier".
- Tap "Hand over to courier" → Pending drops by ₹3,200 and Paid rises by ₹3,200 with a count-up, a toast "₹3,200 sent to UPI rekha@upi" appears, the last-transfer line shows ₹3,200, the card shows "Handed to courier".
- Double-tap a button quickly → it advances exactly one step.
- Switch to हिन्दी → button labels, toast text and last-transfer line are in Hindi.
- Reload → seed state is back. Console has no errors.

- [ ] **Step 10: Commit**

```bash
npx prettier --write vitest.config.ts src/lib/languages.ts src/lib/orders.ts src/lib/orders.test.ts src/lib/i18n.test.ts src/lib/i18n.ts src/lib/kala-store.tsx src/hooks/use-count-up.ts src/routes/orders.tsx src/routes/__root.tsx src/components/kala/AppShell.tsx
git add -A && git commit -m "Make the dispatch tracker work and settle payouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Local-language narration

**Files:**
- Create: `src/content/narration.ts`, `src/content/audio-manifest.json`, `src/content/narration.test.ts`, `src/lib/products.ts`, `src/lib/products.test.ts`, `src/lib/audio.ts`, `src/lib/narrator.tsx`, `src/components/kala/AudioButton.tsx`, `src/components/kala/LanguagePills.tsx`, `scripts/generate-audio.ts`, `public/audio/**`
- Modify: `package.json`, `src/lib/kala-store.tsx`, `src/lib/i18n.ts`, `src/routes/__root.tsx`, `src/components/kala/AppShell.tsx`, `src/components/kala/shared.tsx`, `src/components/kala/ProductModal.tsx`, `src/routes/index.tsx`, `src/routes/catalog.tsx`, `src/routes/orders.tsx`, `docs/superpowers/specs/2026-09-27-round2-polish-design.md`

**Interfaces:**
- Consumes: `LANGUAGE_CODES`, `LanguageCode`, `SPEECH_TAGS` (Task 1); `Order`, `OrderStep` (Task 1).
- Produces: `productCopy`, `ProductCopy`, `ProductId`, `narration`, `ClipId`, `isClipId(value: string): value is ClipId` (narration.ts); `upsertProduct(list, item)`, `localize(product, lang): ProductCopy` (products.ts); `AudioManifest`, `resolveClip(manifest, clip, lang): string | null` (audio.ts); `NarratorProvider`, `useNarrator(): { play(clips: ClipId[]): void; stop(): void; playingKey: string | null }`, `queueKey(clips)` (narrator.tsx); `<AudioButton clips label? iconOnly? className? />`; `<LanguagePills className? />`; kala-store `DEMO_DRAFT_ID = "p4"`, `DEMO_DRAFT: NewProductInput`, `buildDraftProduct(image: string): Product`, context `publishDraft(image: string): Product` (replaces `addProduct`); `NewProductInput = Omit<Product, "id" | "price" | "status">`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/products.test.ts`:

```ts
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
```

Create `src/content/narration.test.ts`:

```ts
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
      console.warn(`No voice for: ${manifest.unsupported.join(", ")} (provider ${manifest.provider})`);
    }
    const missing: string[] = [];
    for (const clip of clips) {
      for (const lang of LANGUAGE_CODES) {
        if (manifest.unsupported.includes(lang)) continue;
        const entry = manifest.clips[clip]?.[lang];
        if (!entry || !existsSync(join("public/audio", entry.file))) missing.push(`${lang}/${clip}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test`
Expected: FAIL — cannot resolve `@/content/narration`, `./products`, `@/lib/audio`.

- [ ] **Step 3: Create `src/content/narration.ts`**

```ts
import type { LanguageCode } from "../lib/languages.ts";

// Loaded by the app, the tests and scripts/generate-audio.ts (plain Node), so keep this
// file free of value imports and path aliases.

type Localized = Record<LanguageCode, string>;
export type ProductCopy = { title: string; story: string };

/** Title and story for every demo product. `en` is the source for the store's seed data. */
export const productCopy = {
  p1: {
    en: {
      title: "Hand-painted Terracotta Water Pot",
      story:
        "Shaped on a foot-powered wheel in a village where potters have read the monsoon in the clay for six generations. The eye motifs are painted to keep the water cool and the home watched over.",
    },
    hi: {
      title: "हाथ से रंगा टेराकोटा पानी का मटका",
      story:
        "छह पीढ़ियों से मिट्टी में मानसून पढ़ने वाले कुम्हारों के गाँव में, पैर से चलने वाले चाक पर इसे आकार दिया गया। आँखों वाले चित्र पानी को ठंडा रखने और घर की रक्षा के लिए बनाए जाते हैं।",
    },
    bn: {
      title: "হাতে আঁকা টেরাকোটা জলের কলসি",
      story:
        "যে গ্রামে ছয় প্রজন্ম ধরে কুমোররা মাটিতে বর্ষার ভাষা পড়েন, সেখানে পায়ে চালানো চাকে এটি গড়া হয়েছে। চোখের নকশাগুলি আঁকা হয় জল ঠান্ডা রাখতে আর ঘরকে পাহারা দিতে।",
    },
    ta: {
      title: "கையால் வரைந்த சுடுமண் தண்ணீர்ப் பானை",
      story:
        "ஆறு தலைமுறைகளாகக் களிமண்ணில் பருவமழையைப் படிக்கும் குயவர்களின் கிராமத்தில், காலால் இயக்கும் சக்கரத்தில் இது வடிவமைக்கப்பட்டது. தண்ணீரைக் குளிர்ச்சியாக வைக்கவும் வீட்டைக் காக்கவும் கண் வடிவங்கள் வரையப்படுகின்றன.",
    },
    mr: {
      title: "हाताने रंगवलेले टेराकोटा पाण्याचे मडके",
      story:
        "सहा पिढ्यांपासून मातीत पावसाळा वाचणाऱ्या कुंभारांच्या गावात, पायाने फिरवायच्या चाकावर याला आकार दिला आहे. पाणी थंड राहावे आणि घरावर नजर राहावी म्हणून डोळ्यांची नक्षी रंगवली जाते.",
    },
    or: {
      title: "ହାତରେ ଚିତ୍ରିତ ଟେରାକୋଟା ପାଣି ମାଠିଆ",
      story:
        "ଛଅ ପିଢ଼ି ଧରି ମାଟିରେ ବର୍ଷା ପଢ଼ୁଥିବା କୁମ୍ଭାରଙ୍କ ଗାଁରେ, ଗୋଡ଼ରେ ଚଳାଯାଉଥିବା ଚକରେ ଏହାକୁ ଆକାର ଦିଆଯାଇଛି। ପାଣିକୁ ଥଣ୍ଡା ରଖିବା ଓ ଘରକୁ ଜଗିବା ପାଇଁ ଆଖି ନକ୍ସା ଅଙ୍କାଯାଏ।",
    },
  },
  p2: {
    en: {
      title: "Indigo Ikat Handloom Shawl",
      story:
        "Each thread is tied and dipped in a fermented indigo vat before it ever meets the loom, so the pattern is born in the yarn rather than printed on the cloth.",
    },
    hi: {
      title: "नील इकत हथकरघा शॉल",
      story:
        "करघे तक पहुँचने से पहले हर धागे को बाँधकर खमीर उठे नील के कुंड में डुबोया जाता है, इसलिए डिज़ाइन कपड़े पर छपता नहीं, धागे में ही जन्म लेता है।",
    },
    bn: {
      title: "নীল ইক্কত তাঁতের শাল",
      story:
        "তাঁতে ওঠার আগেই প্রতিটি সুতো বেঁধে গাঁজানো নীলের গামলায় ডোবানো হয়, তাই নকশা কাপড়ে ছাপা হয় না, জন্মায় সুতোর মধ্যেই।",
    },
    ta: {
      title: "அவுரி இக்கத் கைத்தறி சால்வை",
      story:
        "தறியைச் சேரும் முன்பே ஒவ்வொரு நூலும் கட்டப்பட்டு, புளிக்க வைத்த அவுரிச் சாயத் தொட்டியில் நனைக்கப்படுகிறது. அதனால் வடிவம் துணியில் அச்சிடப்படுவதில்லை, நூலிலேயே பிறக்கிறது.",
    },
    mr: {
      title: "नीळ इकत हातमाग शाल",
      story:
        "मागावर जाण्यापूर्वीच प्रत्येक धागा बांधून आंबवलेल्या नीळीच्या कुंडात बुडवला जातो, त्यामुळे नक्षी कापडावर छापली जात नाही, ती धाग्यातच जन्म घेते.",
    },
    or: {
      title: "ନୀଳ ଇକତ ହସ୍ତତନ୍ତ ଶାଲ",
      story:
        "ତନ୍ତରେ ପହଞ୍ଚିବା ପୂର୍ବରୁ ପ୍ରତ୍ୟେକ ସୂତାକୁ ବାନ୍ଧି ଖମୀର ହୋଇଥିବା ନୀଳ କୁଣ୍ଡରେ ବୁଡ଼ାଯାଏ, ତେଣୁ ନକ୍ସା ଲୁଗାରେ ଛପା ହୁଏନାହିଁ, ସୂତାରେ ହିଁ ଜନ୍ମ ନିଏ।",
    },
  },
  p3: {
    en: {
      title: "Dhokra Brass Lantern",
      story:
        "Cast by the lost-wax method: a wax lattice is wrapped in clay, melted away, and replaced with molten brass — the mould breaks so no two lamps can ever repeat.",
    },
    hi: {
      title: "ढोकरा पीतल लालटेन",
      story:
        "यह लुप्त-मोम विधि से ढाली जाती है: मोम की जाली को मिट्टी में लपेटा जाता है, मोम पिघलाकर उसकी जगह पिघला पीतल भरा जाता है — साँचा टूट जाता है, इसलिए कोई दो दीये कभी एक जैसे नहीं होते।",
    },
    bn: {
      title: "ডোকরা পিতলের লণ্ঠন",
      story:
        "লুপ্ত-মোম পদ্ধতিতে ঢালাই: মোমের জালি মাটিতে মুড়ে, মোম গলিয়ে তার জায়গায় গলানো পিতল ঢালা হয় — ছাঁচ ভেঙে যায়, তাই কোনো দুটি প্রদীপ কখনও এক রকম হয় না।",
    },
    ta: {
      title: "டோக்ரா பித்தளை விளக்கு",
      story:
        "மெழுகு இழப்பு முறையில் வார்க்கப்படுகிறது: மெழுகு வலைப்பின்னல் களிமண்ணில் சுற்றப்பட்டு, உருக்கி நீக்கப்பட்டு, உருகிய பித்தளையால் நிரப்பப்படுகிறது. அச்சு உடைக்கப்படுவதால் எந்த இரண்டு விளக்குகளும் ஒன்றுபோல் இருப்பதில்லை.",
    },
    mr: {
      title: "ढोकरा पितळी कंदील",
      story:
        "हरवलेल्या मेणाच्या पद्धतीने ओतकाम: मेणाची जाळी मातीत गुंडाळून, मेण वितळवून त्याजागी वितळलेले पितळ ओतले जाते — साचा फुटतो, म्हणून कोणतेही दोन दिवे कधीच सारखे नसतात.",
    },
    or: {
      title: "ଢୋକରା ପିତ୍ତଳ ଲଣ୍ଠନ",
      story:
        "ଲୁପ୍ତ-ମହମ ପଦ୍ଧତିରେ ଢଳାଯାଏ: ମହମ ଜାଲିକୁ ମାଟିରେ ଗୁଡ଼ାଇ, ମହମ ତରଳାଇ ତା ସ୍ଥାନରେ ତରଳ ପିତ୍ତଳ ଭରାଯାଏ — ଛାଞ୍ଚ ଭାଙ୍ଗିଯାଏ, ତେଣୁ କୌଣସି ଦୁଇଟି ଦୀପ କେବେ ସମାନ ହୁଏନାହିଁ।",
    },
  },
  // The Studio's new listing: the plain, unpainted pot in craft-raw.jpg.
  p4: {
    en: {
      title: "Wheel-thrown Terracotta Cooking Pot",
      story:
        "Thrown on a village wheel from clay lifted out of the riverbed after the rains, then burnished smooth with a river pebble. Unglazed and wood-fired, it cooks dal slowly and keeps the taste of the earth.",
    },
    hi: {
      title: "चाक पर बनी टेराकोटा हांडी",
      story:
        "बारिश के बाद नदी तल से निकाली मिट्टी से गाँव के चाक पर बनी, फिर नदी के कंकड़ से घिसकर चिकनी की गई। बिना ग्लेज़ और लकड़ी की आँच में पकी यह हांडी दाल को धीमे पकाती है और मिट्टी का स्वाद बनाए रखती है।",
    },
    bn: {
      title: "চাকে গড়া টেরাকোটা রান্নার হাঁড়ি",
      story:
        "বর্ষার পরে নদীর তলা থেকে তোলা মাটি দিয়ে গ্রামের চাকে গড়া, তারপর নদীর নুড়ি দিয়ে ঘষে মসৃণ করা। গ্লেজ ছাড়া, কাঠের আগুনে পোড়ানো এই হাঁড়ি ডাল ধীরে রাঁধে আর মাটির স্বাদ ধরে রাখে।",
    },
    ta: {
      title: "சக்கரத்தில் வனைந்த சுடுமண் சமையல் பானை",
      story:
        "மழைக்குப் பிறகு ஆற்றுப்படுகையிலிருந்து எடுத்த களிமண்ணில் கிராமச் சக்கரத்தில் வனைந்து, ஆற்றுக் கூழாங்கல்லால் தேய்த்து மெருகேற்றப்பட்டது. மெருகுப்பூச்சு இல்லாமல் விறகு அடுப்பில் சுடப்பட்ட இது பருப்பை மெதுவாகச் சமைத்து மண்ணின் சுவையைத் தக்கவைக்கிறது.",
    },
    mr: {
      title: "चाकावर घडवलेले टेराकोटा स्वयंपाकाचे मडके",
      story:
        "पावसानंतर नदीपात्रातून काढलेल्या मातीपासून गावच्या चाकावर घडवले, मग नदीतल्या गोट्याने घासून गुळगुळीत केले. ग्लेझ नसलेले, लाकडाच्या आचेवर भाजलेले हे मडके डाळ हळू शिजवते आणि मातीची चव टिकवते.",
    },
    or: {
      title: "ଚକରେ ଗଢ଼ା ଟେରାକୋଟା ରୋଷେଇ ହାଣ୍ଡି",
      story:
        "ବର୍ଷା ପରେ ନଦୀ ଗର୍ଭରୁ ଅଣାଯାଇଥିବା ମାଟିରେ ଗାଁ ଚକରେ ଗଢ଼ାଯାଇ, ନଦୀ ପଥରରେ ଘଷି ଚିକ୍କଣ କରାଯାଇଛି। ଗ୍ଲେଜ୍ ବିନା, କାଠ ନିଆଁରେ ପୋଡ଼ା ଏହି ହାଣ୍ଡି ଡାଲିକୁ ଧୀରେ ରାନ୍ଧେ ଓ ମାଟିର ସ୍ୱାଦ ବଜାୟ ରଖେ।",
    },
  },
} as const satisfies Record<string, Record<LanguageCode, ProductCopy>>;

export type ProductId = keyof typeof productCopy;

const productClip = (id: ProductId) =>
  Object.fromEntries(
    Object.entries(productCopy[id]).map(([lang, c]) => [lang, `${c.title}. ${c.story}`]),
  ) as Localized;

/** Every spoken clip, in every language. Audio files are generated from this text. */
export const narration = {
  "product.p1": productClip("p1"),
  "product.p2": productClip("p2"),
  "product.p3": productClip("p3"),
  "product.p4": productClip("p4"),

  "screen.studio": {
    en: "This is your Studio. Take a photo of your craft, then press the big microphone and tell us about it in your own language. We will write the listing and suggest a fair price.",
    hi: "यह आपका स्टूडियो है। अपनी कारीगरी की फ़ोटो लें, फिर बड़ा माइक दबाकर अपनी भाषा में उसके बारे में बताएँ। हम लिस्टिंग लिखेंगे और उचित दाम सुझाएँगे।",
    bn: "এটি আপনার স্টুডিও। আপনার শিল্পকর্মের ছবি তুলুন, তারপর বড় মাইক টিপে নিজের ভাষায় তার কথা বলুন। আমরা বিবরণ লিখে দেব আর ন্যায্য দাম জানাব।",
    ta: "இது உங்கள் ஸ்டுடியோ. உங்கள் கைவினைப் பொருளைப் புகைப்படம் எடுத்து, பெரிய மைக்கை அழுத்தி உங்கள் மொழியில் அதைப் பற்றிச் சொல்லுங்கள். நாங்கள் விவரத்தை எழுதி நியாயமான விலையைப் பரிந்துரைப்போம்.",
    mr: "हा तुमचा स्टुडिओ आहे. तुमच्या कलाकृतीचा फोटो घ्या, मग मोठा माइक दाबून तुमच्या भाषेत त्याबद्दल सांगा. आम्ही लिस्टिंग लिहू आणि योग्य किंमत सुचवू.",
    or: "ଏହା ଆପଣଙ୍କ ଷ୍ଟୁଡିଓ। ଆପଣଙ୍କ କାରିଗରୀର ଫଟୋ ନିଅନ୍ତୁ, ତାପରେ ବଡ଼ ମାଇକ ଦବାଇ ନିଜ ଭାଷାରେ ସେ ବିଷୟରେ କୁହନ୍ତୁ। ଆମେ ବିବରଣୀ ଲେଖିବୁ ଓ ଉଚିତ ଦାମ ପରାମର୍ଶ ଦେବୁ।",
  },
  "screen.catalog": {
    en: "This is your shop. Green buttons show where your crafts are on sale. Tap a craft to see how buyers see it, with its authenticity QR code.",
    hi: "यह आपकी दुकान है। हरे बटन बताते हैं कि आपकी चीज़ें कहाँ बिक रही हैं। किसी चीज़ को दबाकर देखें कि खरीदार उसे कैसे देखते हैं, उसके प्रामाणिकता क्यूआर कोड के साथ।",
    bn: "এটি আপনার দোকান। সবুজ বোতাম দেখায় আপনার জিনিস কোথায় বিক্রি হচ্ছে। কোনো জিনিসে টিপে দেখুন ক্রেতারা সেটি কীভাবে দেখেন, তার প্রামাণিকতার কিউআর কোড সহ।",
    ta: "இது உங்கள் கடை. உங்கள் பொருட்கள் எங்கே விற்பனையில் உள்ளன என்பதைப் பச்சைப் பொத்தான்கள் காட்டுகின்றன. ஒரு பொருளைத் தொட்டு, வாங்குபவர்கள் அதை எப்படிப் பார்க்கிறார்கள் என்று அதன் நம்பகத்தன்மை க்யூஆர் குறியீட்டுடன் பாருங்கள்.",
    mr: "हे तुमचे दुकान आहे. हिरवी बटणे दाखवतात की तुमच्या वस्तू कुठे विक्रीला आहेत. एखाद्या वस्तूवर टॅप करून पाहा खरेदीदार ती कशी पाहतात, तिच्या सत्यता क्यूआर कोडसह.",
    or: "ଏହା ଆପଣଙ୍କ ଦୋକାନ। ସବୁଜ ବଟନ ଦେଖାଏ ଆପଣଙ୍କ ଜିନିଷ କେଉଁଠି ବିକ୍ରି ହେଉଛି। କୌଣସି ଜିନିଷକୁ ଦବାଇ ଦେଖନ୍ତୁ କ୍ରେତା ତାକୁ କିପରି ଦେଖନ୍ତି, ତାର ପ୍ରାମାଣିକତା କ୍ୟୁଆର କୋଡ ସହିତ।",
  },
  "screen.orders": {
    en: "These are your orders. For each parcel, press the big button when you pack it, label it and hand it to the courier. Your money is sent to your UPI as soon as it is handed over.",
    hi: "ये आपके ऑर्डर हैं। हर पार्सल को पैक करने, लेबल लगाने और कूरियर को सौंपने पर बड़ा बटन दबाएँ। सौंपते ही आपका पैसा आपके यूपीआई में भेज दिया जाता है।",
    bn: "এগুলি আপনার অর্ডার। প্রতিটি পার্সেল প্যাক করলে, লেবেল লাগালে আর কুরিয়ারকে দিলে বড় বোতামটি টিপুন। হাতে দেওয়ার সঙ্গে সঙ্গেই টাকা আপনার ইউপিআই-তে পাঠানো হয়।",
    ta: "இவை உங்கள் ஆர்டர்கள். ஒவ்வொரு பார்சலையும் பேக் செய்யும்போதும், லேபிள் ஒட்டும்போதும், கூரியரிடம் ஒப்படைக்கும்போதும் பெரிய பொத்தானை அழுத்துங்கள். ஒப்படைத்தவுடன் உங்கள் பணம் உங்கள் யுபிஐ-க்கு அனுப்பப்படும்.",
    mr: "या तुमच्या ऑर्डर आहेत. प्रत्येक पार्सल पॅक केल्यावर, लेबल लावल्यावर आणि कुरियरकडे दिल्यावर मोठे बटण दाबा. सोपवताच तुमचे पैसे तुमच्या यूपीआयवर पाठवले जातात.",
    or: "ଏଗୁଡ଼ିକ ଆପଣଙ୍କ ଅର୍ଡର। ପ୍ରତ୍ୟେକ ପାର୍ସଲ ପ୍ୟାକ କଲେ, ଲେବଲ ଲଗାଇଲେ ଓ କୁରିଅରକୁ ଦେଲେ ବଡ଼ ବଟନ ଦବାନ୍ତୁ। ହସ୍ତାନ୍ତର ହେବା କ୍ଷଣି ଆପଣଙ୍କ ଟଙ୍କା ଆପଣଙ୍କ ୟୁପିଆଇକୁ ପଠାଯାଏ।",
  },

  "order.KL-4471": {
    en: "Order from Meera Textiles Co-op in Bengaluru. Your payout is 3,200 rupees.",
    hi: "बेंगलुरु की मीरा टेक्सटाइल्स को-ऑप से ऑर्डर। आपका भुगतान 3,200 रुपये है।",
    bn: "বেঙ্গালুরুর মীরা টেক্সটাইলস কো-অপ থেকে অর্ডার। আপনার প্রাপ্য 3,200 টাকা।",
    ta: "பெங்களூரு மீரா டெக்ஸ்டைல்ஸ் கூட்டுறவிடமிருந்து ஆர்டர். உங்களுக்குக் கிடைக்கும் தொகை 3,200 ரூபாய்.",
    mr: "बंगळुरूच्या मीरा टेक्सटाइल्स को-ऑपकडून ऑर्डर. तुमचे पेमेंट 3,200 रुपये आहे.",
    or: "ବେଙ୍ଗାଲୁରୁର ମୀରା ଟେକ୍ସଟାଇଲ୍ସ କୋ-ଅପରୁ ଅର୍ଡର। ଆପଣଙ୍କ ପ୍ରାପ୍ୟ 3,200 ଟଙ୍କା।",
  },
  "order.KL-4468": {
    en: "Order from Terra Home Export in Rotterdam, Netherlands. Your payout is 5,800 rupees.",
    hi: "नीदरलैंड के रॉटरडैम की टेरा होम एक्सपोर्ट से ऑर्डर। आपका भुगतान 5,800 रुपये है।",
    bn: "নেদারল্যান্ডসের রটারড্যামের টেরা হোম এক্সপোর্ট থেকে অর্ডার। আপনার প্রাপ্য 5,800 টাকা।",
    ta: "நெதர்லாந்தின் ரோட்டர்டாமில் உள்ள டெர்ரா ஹோம் எக்ஸ்போர்ட்டிடமிருந்து ஆர்டர். உங்களுக்குக் கிடைக்கும் தொகை 5,800 ரூபாய்.",
    mr: "नेदरलँड्समधील रॉटरडॅमच्या टेरा होम एक्सपोर्टकडून ऑर्डर. तुमचे पेमेंट 5,800 रुपये आहे.",
    or: "ନେଦରଲ୍ୟାଣ୍ଡସର ରୋଟରଡାମର ଟେରା ହୋମ ଏକ୍ସପୋର୍ଟରୁ ଅର୍ଡର। ଆପଣଙ୍କ ପ୍ରାପ୍ୟ 5,800 ଟଙ୍କା।",
  },
  "order.KL-4460": {
    en: "Order from Anand Gift House in Raipur. Your payout is 4,100 rupees.",
    hi: "रायपुर के आनंद गिफ़्ट हाउस से ऑर्डर। आपका भुगतान 4,100 रुपये है।",
    bn: "রায়পুরের আনন্দ গিফট হাউস থেকে অর্ডার। আপনার প্রাপ্য 4,100 টাকা।",
    ta: "ராய்ப்பூர் ஆனந்த் கிஃப்ட் ஹவுஸிடமிருந்து ஆர்டர். உங்களுக்குக் கிடைக்கும் தொகை 4,100 ரூபாய்.",
    mr: "रायपूरच्या आनंद गिफ्ट हाऊसकडून ऑर्डर. तुमचे पेमेंट 4,100 रुपये आहे.",
    or: "ରାୟପୁରର ଆନନ୍ଦ ଗିଫ୍ଟ ହାଉସରୁ ଅର୍ଡର। ଆପଣଙ୍କ ପ୍ରାପ୍ୟ 4,100 ଟଙ୍କା।",
  },

  "step.0": {
    en: "Next, pack the item.",
    hi: "अगला काम: सामान पैक करें।",
    bn: "এরপর জিনিসটি প্যাক করুন।",
    ta: "அடுத்து, பொருளை பேக் செய்யுங்கள்.",
    mr: "पुढे, वस्तू पॅक करा.",
    or: "ଏହା ପରେ, ଜିନିଷଟି ପ୍ୟାକ କରନ୍ତୁ।",
  },
  "step.1": {
    en: "Packed! Next, stick the label.",
    hi: "पैक हो गया! अब लेबल लगाएँ।",
    bn: "প্যাক হয়ে গেছে! এবার লেবেল লাগান।",
    ta: "பேக் ஆகிவிட்டது! அடுத்து, லேபிளை ஒட்டுங்கள்.",
    mr: "पॅक झाले! आता लेबल लावा.",
    or: "ପ୍ୟାକ ହୋଇଗଲା! ଏବେ ଲେବଲ ଲଗାନ୍ତୁ।",
  },
  "step.2": {
    en: "Label done! Next, hand it to the courier.",
    hi: "लेबल लग गया! अब इसे कूरियर को सौंपें।",
    bn: "লেবেল লাগানো হয়েছে! এবার কুরিয়ারের হাতে দিন।",
    ta: "லேபிள் ஒட்டியாகிவிட்டது! அடுத்து, கூரியரிடம் ஒப்படையுங்கள்.",
    mr: "लेबल लावले! आता कुरियरकडे सोपवा.",
    or: "ଲେବଲ ଲାଗିଗଲା! ଏବେ କୁରିଅରକୁ ହସ୍ତାନ୍ତର କରନ୍ତୁ।",
  },
  "step.3": {
    en: "Handed over! Your payout is on its way to your UPI.",
    hi: "सौंप दिया! आपका भुगतान आपके यूपीआई पर भेजा जा रहा है।",
    bn: "হাতে দেওয়া হয়েছে! আপনার টাকা ইউপিআই-তে যাচ্ছে।",
    ta: "ஒப்படைக்கப்பட்டது! உங்கள் பணம் உங்கள் யுபிஐ-க்கு வருகிறது.",
    mr: "सोपवले! तुमचे पैसे तुमच्या यूपीआयवर येत आहेत.",
    or: "ହସ୍ତାନ୍ତର ହେଲା! ଆପଣଙ୍କ ଟଙ୍କା ଆପଣଙ୍କ ୟୁପିଆଇକୁ ଆସୁଛି।",
  },
} satisfies Record<string, Localized>;

export type ClipId = keyof typeof narration;

export const isClipId = (value: string): value is ClipId => Object.hasOwn(narration, value);
```

- [ ] **Step 4: Create `src/lib/products.ts`, `src/lib/audio.ts` and the empty manifest**

`src/lib/products.ts`:

```ts
import { productCopy, type ProductCopy } from "@/content/narration";
import type { LanguageCode } from "@/lib/languages";

export function upsertProduct<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((p) => p.id === item.id)
    ? list.map((p) => (p.id === item.id ? item : p))
    : [item, ...list];
}

const copyById: Record<string, Record<LanguageCode, ProductCopy>> = productCopy;

/** Title and story in the chosen language; falls back to the product's own text. */
export function localize(
  product: { id: string; title: string; story: string },
  lang: LanguageCode,
): ProductCopy {
  return copyById[product.id]?.[lang] ?? { title: product.title, story: product.story };
}
```

`src/lib/audio.ts`:

```ts
import type { LanguageCode } from "@/lib/languages";

export type AudioManifest = {
  provider: string | null;
  unsupported: string[];
  clips: Record<string, Partial<Record<LanguageCode, { file: string; hash: string }>>>;
};

/** Public URL of a clip's audio file, or null when it was not generated. */
export function resolveClip(
  manifest: AudioManifest,
  clip: string,
  lang: LanguageCode,
): string | null {
  const file = manifest.clips[clip]?.[lang]?.file;
  return file ? `/audio/${file}` : null;
}
```

`src/content/audio-manifest.json`:

```json
{
  "provider": null,
  "unsupported": [],
  "clips": {}
}
```

- [ ] **Step 5: Run the tests**

Run: `bun run test`
Expected: products and narration-text tests PASS; `narration audio › has an audio file…` FAILS listing 84 missing clips (fixed in Step 12).

- [ ] **Step 6: Store — seed copy, fixed-id draft, `publishDraft`**

In `src/lib/kala-store.tsx`:

1. Add imports: `import { productCopy } from "@/content/narration";` and `import { upsertProduct } from "@/lib/products";`
2. In each seed product replace the `title` and `story` lines with a spread of the English copy, e.g. for p1: `...productCopy.p1.en,` (p2 → `productCopy.p2.en`, p3 → `productCopy.p3.en`).
3. Replace the explicit `NewProductInput` type with:

```ts
export type NewProductInput = Omit<Product, "id" | "price" | "status">;
```

4. After `suggestedPrice`, add (`pottery` is the existing import; Task 3 replaces it with the cleaned pot):

```ts
export const DEMO_DRAFT_ID = "p4";

export const DEMO_DRAFT: NewProductInput = {
  ...productCopy.p4.en,
  category: "Pottery & Clay",
  technique: "Wheel-thrown, pebble-burnished, wood-fired",
  materials: ["River clay", "Rice husk"],
  image: pottery,
  materialCost: 220,
  labourHours: 7,
  hourlyRate: 125,
  benchmark: 610,
  stock: 5,
  origin: "Kutch, Gujarat",
  giTag: "GI: Khavda Pottery",
};

export function buildDraftProduct(image: string): Product {
  return {
    ...DEMO_DRAFT,
    image,
    id: DEMO_DRAFT_ID,
    price: suggestedPrice(DEMO_DRAFT),
    status: "listed",
  };
}
```

5. In `KalaContextValue` replace `addProduct: (input: NewProductInput) => Product;` with `publishDraft: (image: string) => Product;`. Replace the `addProduct` callback with:

```ts
  const publishDraft = useCallback((image: string) => {
    const product = buildDraftProduct(image);
    setProducts((prev) => upsertProduct(prev, product));
    return product;
  }, []);
```

and rename `addProduct` → `publishDraft` in the `value` object and its dependency list.

- [ ] **Step 7: New UI strings**

In `src/lib/i18n.ts` add after `"common.hrs"` in each dictionary:

| lang | `"common.stop"` | `"shell.screenGuide"` |
|---|---|---|
| en | `"Stop"` | `"What's on this screen?"` |
| hi | `"रोकें"` | `"इस स्क्रीन पर क्या है?"` |
| bn | `"থামান"` | `"এই স্ক্রিনে কী আছে?"` |
| ta | `"நிறுத்து"` | `"இந்தத் திரையில் என்ன உள்ளது?"` |
| mr | `"थांबवा"` | `"या स्क्रीनवर काय आहे?"` |
| or | `"ବନ୍ଦ କରନ୍ତୁ"` | `"ଏହି ସ୍କ୍ରିନରେ କଣ ଅଛି?"` |

- [ ] **Step 8: Narrator provider and AudioButton**

Create `src/lib/narrator.tsx`:

```tsx
import { useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import manifestJson from "@/content/audio-manifest.json";
import { narration, type ClipId } from "@/content/narration";
import { resolveClip, type AudioManifest } from "@/lib/audio";
import { useKala } from "@/lib/kala-store";
import { SPEECH_TAGS, type LanguageCode } from "@/lib/languages";

const manifest = manifestJson as AudioManifest;

type NarratorValue = {
  play: (clips: ClipId[]) => void;
  stop: () => void;
  /** `queueKey` of the clips currently playing, or null. */
  playingKey: string | null;
};

const NarratorContext = createContext<NarratorValue | null>(null);

export const queueKey = (clips: ClipId[]) => clips.join("|");

function speakFallback(clip: ClipId, lang: LanguageCode, done: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return done();
  const utterance = new SpeechSynthesisUtterance(narration[clip][lang]);
  utterance.lang = SPEECH_TAGS[lang];
  utterance.onend = done;
  utterance.onerror = done;
  window.speechSynthesis.speak(utterance);
}

export function NarratorProvider({ children }: { children: ReactNode }) {
  const { language } = useKala();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<ClipId[]>([]);
  // Bumped on every stop; callbacks from an older queue see a stale token and bail out.
  const tokenRef = useRef(0);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    queueRef.current = [];
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingKey(null);
  }, []);

  const playNext = useCallback(
    (token: number) => {
      if (token !== tokenRef.current) return;
      const clip = queueRef.current.shift();
      if (!clip) {
        setPlayingKey(null);
        return;
      }
      let settled = false;
      let fellBack = false;
      const done = () => {
        if (settled) return;
        settled = true;
        playNext(token);
      };
      const fallback = () => {
        if (fellBack || settled || token !== tokenRef.current) return;
        fellBack = true;
        speakFallback(clip, language, done);
      };
      const src = resolveClip(manifest, clip, language);
      if (!src) return fallback();
      const audio = audioRef.current ?? (audioRef.current = new Audio());
      audio.onended = done;
      audio.onerror = fallback;
      audio.src = src;
      audio.play().catch(fallback);
    },
    [language],
  );

  const play = useCallback(
    (clips: ClipId[]) => {
      stop();
      queueRef.current = [...clips];
      setPlayingKey(queueKey(clips));
      playNext(tokenRef.current);
    },
    [stop, playNext],
  );

  // Stop when the language changes or the user moves to another screen.
  useEffect(() => stop, [language, pathname, stop]);

  const value = useMemo(() => ({ play, stop, playingKey }), [play, stop, playingKey]);
  return <NarratorContext.Provider value={value}>{children}</NarratorContext.Provider>;
}

export function useNarrator() {
  const ctx = useContext(NarratorContext);
  if (!ctx) throw new Error("useNarrator must be used inside NarratorProvider");
  return ctx;
}
```

Create `src/components/kala/AudioButton.tsx`:

```tsx
import { Volume2 } from "lucide-react";

import type { ClipId } from "@/content/narration";
import { useKala } from "@/lib/kala-store";
import { queueKey, useNarrator } from "@/lib/narrator";
import { cn } from "@/lib/utils";

export function AudioButton({
  clips,
  label,
  iconOnly = false,
  className,
}: {
  clips: ClipId[];
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const { t } = useKala();
  const { play, stop, playingKey } = useNarrator();
  const playing = playingKey === queueKey(clips);
  const text = playing ? t("common.stop") : (label ?? t("common.listen"));

  return (
    <button
      type="button"
      onClick={() => (playing ? stop() : play(clips))}
      aria-pressed={playing}
      aria-label={text}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-indigo text-xs font-semibold text-indigo-foreground active:scale-95",
        iconOnly ? "size-9" : "px-3 py-2",
        className,
      )}
    >
      {playing ? <SoundBars /> : <Volume2 className="size-4" />}
      {!iconOnly && text}
    </button>
  );
}

function SoundBars() {
  return (
    <span aria-hidden className="flex h-4 items-center gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="wave-bar h-4 w-0.5 rounded-full bg-current"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}
```

In `src/routes/__root.tsx` import `NarratorProvider` from `@/lib/narrator` and wrap the outlet:

```tsx
      <KalaProvider>
        <NarratorProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster position="top-center" richColors />
        </NarratorProvider>
      </KalaProvider>
```

- [ ] **Step 9: Language pills component and screen guide**

Create `src/components/kala/LanguagePills.tsx`:

```tsx
import { LANGUAGES, useKala } from "@/lib/kala-store";
import { cn } from "@/lib/utils";

export function LanguagePills({ className }: { className?: string }) {
  const { language, setLanguage } = useKala();
  return (
    <div className={cn("flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none]", className)}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLanguage(l.code)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            language === l.code
              ? "border-transparent bg-indigo text-indigo-foreground"
              : "border-border bg-secondary text-secondary-foreground",
          )}
        >
          {l.native}
        </button>
      ))}
    </div>
  );
}
```

In `src/components/kala/AppShell.tsx`:
1. Imports: remove `LANGUAGES` from the kala-store import (keep `ARTISAN`, `useKala`); add `import { AudioButton } from "@/components/kala/AudioButton";` and `import { LanguagePills } from "@/components/kala/LanguagePills";`.
2. Add prop `screen: "studio" | "catalog" | "orders";` to the props type and destructuring; `const { t } = useKala();` (language/setLanguage no longer needed here).
3. Replace the language-pill `<div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">…</div>` with:

```tsx
          <div className="mt-3 flex items-center gap-2 px-4 pb-3">
            <LanguagePills className="flex-1" />
            <AudioButton
              clips={[`screen.${screen}` as const]}
              label={t("shell.screenGuide")}
              iconOnly
            />
          </div>
```

- [ ] **Step 10: Replace SpeakButton everywhere**

`src/components/kala/shared.tsx`: delete `speak` and `SpeakButton`, and remove `Volume2` from the lucide import.

`src/components/kala/ProductModal.tsx`:
- Imports: `import { AudioButton } from "@/components/kala/AudioButton";`, `import { AuthenticityBadge } from "@/components/kala/shared";`, `import { isClipId } from "@/content/narration";`, `import { localize } from "@/lib/products";`; take `language` from `useKala()`.
- After the `if (!product) return null;` line add:

```tsx
  const copy = localize(product, language);
  const clip = `product.${product.id}`;
```

- Use `copy.title` for the `<h2>` and image `alt`, `copy.story` for the story paragraph, and replace the SpeakButton with `{isClipId(clip) && <AudioButton clips={[clip]} label={t("common.play")} />}`.

`src/routes/catalog.tsx`: take `language` from `useKala()`, import `localize` from `@/lib/products`, pass `screen="catalog"` to `AppShell`, and use `localize(p, language).title` for the card title and image `alt`.

`src/routes/index.tsx`:
- Remove the local `draft` constant and the `NewProductInput` import; import `DEMO_DRAFT, DEMO_DRAFT_ID` from `@/lib/kala-store`, `AudioButton` from `@/components/kala/AudioButton`, `localize` from `@/lib/products`; remove the `SpeakButton` import.
- `const { publishDraft, language, t } = useKala();`
- Rename the interval variable inside the recording effect from `t` to `timer`.
- Replace every `draft.` with `DEMO_DRAFT.`; add `const copy = localize({ id: DEMO_DRAFT_ID, title: DEMO_DRAFT.title, story: DEMO_DRAFT.story }, language);` and render `copy.title` / `copy.story` in the listing card.
- `const publish = () => setPublished(publishDraft(cleanShot));`
- Replace the listing SpeakButton with `<AudioButton clips={["product.p4"]} />`.
- Pass `screen="studio"` to `AppShell`.

`src/routes/orders.tsx`:
- Replace the `SpeakButton` import with `import { AudioButton } from "@/components/kala/AudioButton";`, add `import { isClipId, type ClipId } from "@/content/narration";`, `import { useNarrator } from "@/lib/narrator";`, and add `type OrderStep` to the `@/lib/orders` import.
- Add above `OrdersPage`:

```tsx
function orderClips(o: Order): ClipId[] {
  const summary = `order.${o.id}`;
  return [...(isClipId(summary) ? [summary] : []), `step.${o.step}` as const];
}
```

- In `OrdersPage`: `const { play } = useNarrator();`; in `onAdvance`, after `advanceOrder(o.id);` add:

```tsx
    const nextStep = (o.step + 1) as OrderStep;
    play([`step.${nextStep}` as const]);
```

- Delete the `instructions` constant; replace the SpeakButton with `<AudioButton clips={orderClips(o)} label={t("orders.hear")} />`; pass `screen="orders"` to `AppShell`.
- Take `language` from `useKala()`, import `localize` from `@/lib/products`, and show the card title and image `alt` as `product ? localize(product, language).title : ""` so order cards match the selected language.

Run `npx tsc --noEmit` — expected: no errors.

- [ ] **Step 11: Audio generator**

Create `scripts/generate-audio.ts`:

```ts
/**
 * Pre-generates narration audio into public/audio/<lang>/<clip>.<ext> and writes
 * src/content/audio-manifest.json. Unchanged clips are skipped.
 *
 * Usage: node scripts/generate-audio.ts --provider sarvam|mac [--force]
 * Sarvam needs SARVAM_API_KEY in .env.local (git-ignored).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { narration } from "../src/content/narration.ts";
import { LANGUAGE_CODES, type LanguageCode } from "../src/lib/languages.ts";

type Provider = "sarvam" | "mac";
type Entry = { file: string; hash: string };
type Manifest = {
  provider: Provider | null;
  unsupported: LanguageCode[];
  clips: Record<string, Partial<Record<LanguageCode, Entry>>>;
};

const AUDIO_DIR = "public/audio";
const MANIFEST_PATH = "src/content/audio-manifest.json";

const SARVAM_MODEL = "bulbul:v2";
const SARVAM_SPEAKER = "anushka";
const SARVAM_LANG: Record<LanguageCode, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  mr: "mr-IN",
  or: "od-IN",
};
// macOS has no Marathi or Odia voice; Lekha reads Devanagari Marathi acceptably.
const MAC_VOICE: Partial<Record<LanguageCode, string>> = {
  en: "Aman",
  hi: "Lekha",
  bn: "Piya",
  ta: "Vani",
  mr: "Lekha",
};

const args = process.argv.slice(2);
const provider = args[args.indexOf("--provider") + 1];
if (provider !== "sarvam" && provider !== "mac") {
  console.error("Usage: node scripts/generate-audio.ts --provider sarvam|mac [--force]");
  process.exit(1);
}
const force = args.includes("--force");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const ext = provider === "sarvam" ? "mp3" : "m4a";
const voiceFor = (lang: LanguageCode) =>
  provider === "sarvam" ? `${SARVAM_MODEL}/${SARVAM_SPEAKER}` : MAC_VOICE[lang];

async function synthSarvam(text: string, lang: LanguageCode): Promise<Buffer> {
  const key = process.env["SARVAM_API_KEY"];
  if (!key) throw new Error("SARVAM_API_KEY is not set — add it to .env.local");
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      language_code: SARVAM_LANG[lang],
      model: SARVAM_MODEL,
      speaker: SARVAM_SPEAKER,
      output_audio_codec: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`Sarvam ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { audios?: string[] };
  const audio = body.audios?.[0];
  if (!audio) throw new Error("Sarvam returned no audio");
  return Buffer.from(audio, "base64");
}

function synthMac(text: string, voice: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "hunarsetu-say-"));
  try {
    const aiff = join(dir, "clip.aiff");
    const m4a = join(dir, "clip.m4a");
    execFileSync("say", ["-v", voice, "-o", aiff, text]);
    execFileSync("afconvert", ["-f", "m4af", "-d", "aac", aiff, m4a]);
    return readFileSync(m4a);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const previous: Manifest = existsSync(MANIFEST_PATH)
  ? (JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest)
  : { provider: null, unsupported: [], clips: {} };
const next: Manifest = { provider, unsupported: [], clips: {} };
let made = 0;
let kept = 0;

for (const [clip, texts] of Object.entries(narration)) {
  for (const lang of LANGUAGE_CODES) {
    const voice = voiceFor(lang);
    if (!voice) {
      if (!next.unsupported.includes(lang)) next.unsupported.push(lang);
      continue;
    }
    const text = texts[lang];
    const hash = createHash("sha1").update(`${provider}|${voice}|${text}`).digest("hex");
    const file = `${lang}/${clip}.${ext}`;
    const old = previous.clips[clip]?.[lang];
    (next.clips[clip] ??= {})[lang] = { file, hash };

    if (!force && old?.hash === hash && existsSync(join(AUDIO_DIR, old.file))) {
      kept += 1;
      continue;
    }
    const audio = provider === "sarvam" ? await synthSarvam(text, lang) : synthMac(text, voice);
    mkdirSync(dirname(join(AUDIO_DIR, file)), { recursive: true });
    writeFileSync(join(AUDIO_DIR, file), audio);
    if (old && old.file !== file) rmSync(join(AUDIO_DIR, old.file), { force: true });
    made += 1;
    console.log(`✓ ${file}`);
  }
}

writeFileSync(MANIFEST_PATH, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Done: ${made} generated, ${kept} unchanged.`);
if (next.unsupported.length > 0) {
  console.warn(`No ${provider} voice for: ${next.unsupported.join(", ")}`);
}
```

In `package.json` `scripts`, add `"audio": "node scripts/generate-audio.ts"`.

- [ ] **Step 12: Generate with the Mac voices and run the tests**

Run: `bun run audio -- --provider mac`
Expected: 70 `✓` lines (14 clips × 5 languages), then `No mac voice for: or`.

Run: `bun run test`
Expected: all PASS, with the warning `No voice for: or (provider mac)`.

- [ ] **Step 13: Update the spec's Mac voice**

In `docs/superpowers/specs/2026-09-27-round2-polish-design.md` §3.3 change `en Rishi (en_IN)` to `en Aman (en_IN)` (the "Rishi" voice name contains parentheses and is ambiguous for `say -v`).

- [ ] **Step 14: Verify in the browser (Review Focus 2)**

`npx tsc --noEmit` clean. At 375×812:
- Studio: tap the round speaker next to the language pills → Studio guide plays in English; the button shows sound bars; tap again → stops.
- Switch to हिन्दी while it plays → audio stops immediately; tap again → Hindi guide plays.
- Start the guide, then tap the Catalog tab → audio stops.
- Catalog in हिन्दी → card titles in Hindi; open the shawl → Hindi title and story; "चलाएँ" plays the Hindi story.
- Orders: "ऑर्डर सुनें" plays the summary then the current step back-to-back; tapping an advance button plays the new step's clip; starting one clip while another plays stops the first.
- Odia: tapping a speaker falls back to the browser voice or stays silent, with no console error.
- Studio → record → publish twice → the catalog shows one "Wheel-thrown Terracotta Cooking Pot" listing.

- [ ] **Step 15: Commit**

```bash
npx prettier --write src/content/narration.ts src/content/narration.test.ts src/lib/products.ts src/lib/products.test.ts src/lib/audio.ts src/lib/narrator.tsx src/lib/kala-store.tsx src/lib/i18n.ts src/components/kala/*.tsx src/routes/*.tsx scripts/generate-audio.ts
git add -A && git commit -m "Add local-language narration with pre-generated audio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Background cleanup that never alters the product

**Files:**
- Create: `scripts/clean-backgrounds.ts`, `scripts/clean-backgrounds.test.ts`, `src/assets/clean/*` (generated), `src/lib/clean-assets.ts`, `src/components/kala/CleanPhoto.tsx`, `src/components/kala/BeforeAfterSlider.tsx`, `src/components/kala/ScanOverlay.tsx`
- Modify: `package.json`, `src/styles.css`, `src/lib/i18n.ts`, `src/lib/kala-store.tsx`, `src/routes/index.tsx`

**Interfaces:**
- Consumes: `DEMO_DRAFT`, `DEMO_DRAFT_ID`, `publishDraft(image)` (Task 2); `localize` (Task 2); `AudioButton` (Task 2).
- Produces: `BgStyle = "studio" | "linen" | "indigo"`, `BG_STYLES`, `CLEAN = { raw, cutout, mask, backgrounds: Record<BgStyle,string>, composites: Record<BgStyle,string> }` (clean-assets.ts). `DEMO_DRAFT.image` becomes `CLEAN.composites.studio`.

- [ ] **Step 1: Install the image tools**

```bash
bun add -d @imgly/background-removal-node sharp
```

- [ ] **Step 2: Write the failing test**

Create `scripts/clean-backgrounds.test.ts`:

```ts
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
const alphaOf = async (path: string) => sharp(path).ensureAlpha().extractChannel(3).raw().toBuffer();

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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bun run test scripts/clean-backgrounds.test.ts`
Expected: FAIL — input files missing in `src/assets/clean`.

- [ ] **Step 4: Write the pipeline**

Create `scripts/clean-backgrounds.ts`:

```ts
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
  cutoutRgba[p * 4] = rgb[p * 3]!;
  cutoutRgba[p * 4 + 1] = rgb[p * 3 + 1]!;
  cutoutRgba[p * 4 + 2] = rgb[p * 3 + 2]!;
  cutoutRgba[p * 4 + 3] = alpha[p]!;
  maskRgba[p * 4 + 3] = alpha[p]!;
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
  const bg = await sharp(Buffer.from(backgroundSvg(style))).flatten().jpeg({ quality: 90 }).toBuffer();
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
```

In `package.json` `scripts`, add `"clean-bg": "node scripts/clean-backgrounds.ts"`.

- [ ] **Step 5: Run the pipeline and inspect the output**

Run: `bun run clean-bg`
Expected: `✓ studio`, `✓ linen`, `✓ indigo`, then the matte box (roughly x 285–530, bottom ≈ 570). The first run downloads nothing — model files ship inside the package.

Open `src/assets/clean/pot-studio.webp` and `pot-cutout.png` (Read tool / Preview). Check: the whole pot including rim and base is present, no table clutter or other pots. If the rim or base is clipped, widen `ROI`; if the table is included, lower the `>= 240` snap threshold to `>= 250` and re-run.

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun run test scripts/clean-backgrounds.test.ts`
Expected: PASS (9 size checks, matte coverage, 4 pixel-identity checks).

- [ ] **Step 7: Asset module, strings and styles**

Create `src/lib/clean-assets.ts`:

```ts
import raw from "@/assets/craft-raw.jpg";
import bgIndigo from "@/assets/clean/bg-indigo.jpg";
import bgLinen from "@/assets/clean/bg-linen.jpg";
import bgStudio from "@/assets/clean/bg-studio.jpg";
import cutout from "@/assets/clean/pot-cutout.png";
import potIndigo from "@/assets/clean/pot-indigo.webp";
import potLinen from "@/assets/clean/pot-linen.webp";
import mask from "@/assets/clean/pot-mask.png";
import potStudio from "@/assets/clean/pot-studio.webp";

export type BgStyle = "studio" | "linen" | "indigo";

export const BG_STYLES: BgStyle[] = ["studio", "linen", "indigo"];

/** Generated by scripts/clean-backgrounds.ts from craft-raw.jpg. */
export const CLEAN = {
  raw,
  cutout,
  mask,
  backgrounds: { studio: bgStudio, linen: bgLinen, indigo: bgIndigo } satisfies Record<BgStyle, string>,
  composites: { studio: potStudio, linen: potLinen, indigo: potIndigo } satisfies Record<BgStyle, string>,
};
```

In `src/lib/kala-store.tsx`, import `CLEAN` from `@/lib/clean-assets` and change `DEMO_DRAFT`'s `image: pottery,` to `image: CLEAN.composites.studio,`.

Append to `src/styles.css`:

```css
@keyframes kala-scan {
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(300%);
  }
}

@utility scan-sweep {
  animation: kala-scan 1.5s ease-in-out forwards;
}

@keyframes kala-mask-glow {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 0.45;
  }
}

@utility mask-glow {
  animation: kala-mask-glow 1.5s ease-in-out forwards;
}

@keyframes kala-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@utility fade-in-slow {
  animation: kala-fade-in 700ms ease-out both;
}
```

In `src/lib/i18n.ts` add after `"studio.takePhoto"` in each dictionary:

| key | en | hi | bn | ta | mr | or |
|---|---|---|---|---|---|---|
| `studio.finding` | Finding your product… | आपका उत्पाद ढूँढ रहे हैं… | আপনার পণ্য খোঁজা হচ্ছে… | உங்கள் பொருளைக் கண்டறிகிறோம்… | तुमचे उत्पादन शोधत आहोत… | ଆପଣଙ୍କ ଉତ୍ପାଦ ଖୋଜୁଛୁ… |
| `studio.pixelsUnchanged` | Product pixels unchanged ✓ | उत्पाद के पिक्सेल अपरिवर्तित ✓ | পণ্যের পিক্সেল অপরিবর্তিত ✓ | பொருளின் பிக்சல்கள் மாறவில்லை ✓ | उत्पादनाचे पिक्सेल अपरिवर्तित ✓ | ଉତ୍ପାଦର ପିକ୍ସେଲ ଅପରିବର୍ତ୍ତିତ ✓ |
| `studio.bgStudio` | Studio | स्टूडियो | স্টুডিও | ஸ்டுடியோ | स्टुडिओ | ଷ୍ଟୁଡିଓ |
| `studio.bgLinen` | Linen | लिनन | লিনেন | லினன் | लिनन | ଲିନେନ |
| `studio.bgIndigo` | Indigo | नील | নীল | அவுரி | नीळ | ନୀଳ |
| `studio.compare` | Drag to compare | तुलना के लिए खिसकाएँ | তুলনা করতে টানুন | ஒப்பிட இழுக்கவும் | तुलना करण्यासाठी ओढा | ତୁଳନା ପାଇଁ ଟାଣନ୍ତୁ |
| `studio.before` | Before | पहले | আগে | முன் | आधी | ପୂର୍ବରୁ |
| `studio.after` | After | बाद में | পরে | பின் | नंतर | ପରେ |

- [ ] **Step 8: Photo components**

Create `src/components/kala/CleanPhoto.tsx`:

```tsx
import { CLEAN, type BgStyle } from "@/lib/clean-assets";
import { cn } from "@/lib/utils";

/**
 * Background and product are separate layers: enhancement filters touch only the
 * background, so the product is always shown exactly as photographed.
 */
export function CleanPhoto({ bgStyle, enhanced }: { bgStyle: BgStyle; enhanced: boolean }) {
  return (
    <div className="relative size-full">
      <img
        src={CLEAN.backgrounds[bgStyle]}
        alt=""
        draggable={false}
        className={cn(
          "absolute inset-0 size-full object-cover transition-[filter] duration-500",
          enhanced && "brightness-105 contrast-110 saturate-125",
        )}
      />
      <img
        src={CLEAN.cutout}
        alt="The pot on a clean background"
        draggable={false}
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );
}
```

Create `src/components/kala/ScanOverlay.tsx`:

```tsx
import { CLEAN } from "@/lib/clean-assets";

export function ScanOverlay({ label }: { label: string }) {
  const mask = `url(${CLEAN.mask})`;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" role="status">
      <div
        className="mask-glow absolute inset-0 bg-primary"
        style={{ maskImage: mask, WebkitMaskImage: mask, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
      />
      <div className="scan-sweep absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-transparent via-background/70 to-transparent" />
      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/80 px-3 py-1.5 text-xs font-semibold text-background">
        {label}
      </span>
    </div>
  );
}
```

Create `src/components/kala/BeforeAfterSlider.tsx`:

```tsx
import { ChevronsLeftRight } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

export function BeforeAfterSlider({
  before,
  after,
  label,
  beforeLabel,
  afterLabel,
}: {
  before: ReactNode;
  after: ReactNode;
  label: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [pos, setPos] = useState(50);

  const moveTo = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) moveTo(e.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
    if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className="fade-in-slow relative size-full cursor-ew-resize touch-none select-none"
    >
      <div className="absolute inset-0">{after}</div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {before}
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-background"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-background text-foreground shadow-lift">
          <ChevronsLeftRight className="size-4" />
        </span>
      </div>
      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold">
        {afterLabel}
      </span>
    </div>
  );
}
```

- [ ] **Step 9: Studio photo flow**

In `src/routes/index.tsx`:

1. Imports: remove `rawShot`/`cleanShot` image imports; add

```tsx
import { useEffect, useRef, useState } from "react";

import { BeforeAfterSlider } from "@/components/kala/BeforeAfterSlider";
import { CleanPhoto } from "@/components/kala/CleanPhoto";
import { ScanOverlay } from "@/components/kala/ScanOverlay";
import { BG_STYLES, CLEAN, type BgStyle } from "@/lib/clean-assets";
```

2. Above `StudioPage`:

```tsx
type Phase = "raw" | "scanning" | "clean";
const REVEAL_MS = 1500;
const bgLabelKey = {
  studio: "studio.bgStudio",
  linen: "studio.bgLinen",
  indigo: "studio.bgIndigo",
} as const;
```

3. In `StudioPage` replace `const [cleaned, setCleaned] = useState(false);` with:

```tsx
  const [phase, setPhase] = useState<Phase>("raw");
  const [bgStyle, setBgStyle] = useState<BgStyle>("studio");
  const revealed = useRef(false);
  const cleaned = phase === "clean";

  useEffect(() => {
    if (phase !== "scanning") return;
    const timer = setTimeout(() => setPhase("clean"), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // First tap runs the reveal; later taps toggle instantly.
  const toggleClean = () => {
    if (phase === "scanning") return;
    if (phase === "clean") return setPhase("raw");
    setPhase(revealed.current ? "clean" : "scanning");
    revealed.current = true;
  };
```

and change `publish` to `const publish = () => setPublished(publishDraft(CLEAN.composites[bgStyle]));`.

4. Replace the photo `<div className="relative">…</div>` (the `<img>` and its label) with:

```tsx
        <div className="relative aspect-square">
          {cleaned ? (
            <BeforeAfterSlider
              before={
                <img src={CLEAN.raw} alt="Raw workshop photo of the pot" draggable={false} className="size-full object-cover" />
              }
              after={<CleanPhoto bgStyle={bgStyle} enhanced={enhanced} />}
              label={t("studio.compare")}
              beforeLabel={t("studio.before")}
              afterLabel={t("studio.after")}
            />
          ) : (
            <img
              src={CLEAN.raw}
              alt="Raw workshop photo of the pot"
              width={800}
              height={800}
              className="size-full object-cover"
            />
          )}
          {phase === "scanning" && <ScanOverlay label={t("studio.finding")} />}
          {cleaned ? (
            <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-leaf px-2.5 py-1 text-[11px] font-semibold text-leaf-foreground">
              {t("studio.pixelsUnchanged")}
            </span>
          ) : (
            <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold">
              {t("studio.yourPhoto")}
            </span>
          )}
        </div>
```

5. At the top of the `<div className="space-y-3 p-4">` below the photo, insert the swatches:

```tsx
          {cleaned && (
            <div className="flex items-center justify-center gap-4">
              {BG_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setBgStyle(style)}
                  aria-pressed={bgStyle === style}
                  className="flex flex-col items-center gap-1 text-[11px] font-medium"
                >
                  <img
                    src={CLEAN.backgrounds[style]}
                    alt=""
                    className={cn(
                      "size-11 rounded-full object-cover ring-2 ring-offset-2 ring-offset-card",
                      bgStyle === style ? "ring-primary" : "ring-transparent",
                    )}
                  />
                  {t(bgLabelKey[style])}
                </button>
              ))}
            </div>
          )}
```

6. The AI background button: `onClick={toggleClean}` and highlight when `phase !== "raw"`. The Auto enhance button: add `disabled={!cleaned}` and `disabled:opacity-50` to its classes (enhancement only applies to the separated background).

- [ ] **Step 10: Type-check and run all tests**

Run: `npx tsc --noEmit && bun run test`
Expected: no type errors; all tests PASS.

- [ ] **Step 11: Verify in the browser (Review Focus 4)**

At 375×812 on `/`:
- Tap AI background → a ~1.5 s shimmer sweeps down, the pot silhouette glows, "Finding your product…" shows, then the clean photo fades in split by the slider.
- Drag the handle across the pot → the pot's edges line up exactly on both sides; the green "Product pixels unchanged ✓" tag shows.
- Tap Linen / Indigo swatches → only the background changes. Tap Auto enhance → only the background changes.
- Tap AI background twice → raw, then clean again instantly (no second scan).
- Record → publish with Indigo selected → switch to Studio style → publish again → catalog shows one pot listing with the Studio background; Buyer view shows the same.

- [ ] **Step 12: Commit**

```bash
npx prettier --write scripts/clean-backgrounds.ts scripts/clean-backgrounds.test.ts src/lib/clean-assets.ts src/lib/kala-store.tsx src/lib/i18n.ts src/components/kala/CleanPhoto.tsx src/components/kala/ScanOverlay.tsx src/components/kala/BeforeAfterSlider.tsx src/routes/index.tsx src/styles.css
git add -A && git commit -m "Clean the photo background without touching product pixels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Authenticity QR and verification page

**Files:**
- Create: `src/lib/kala-store.test.ts`, `src/components/kala/AuthenticityQr.tsx`, `src/components/kala/QrSheet.tsx`, `src/routes/p.$id.tsx`
- Modify: `package.json`, `src/lib/kala-store.tsx`, `src/lib/i18n.ts`, `src/components/kala/shared.tsx`, `src/components/kala/ProductModal.tsx`, `src/routes/catalog.tsx`, `src/routeTree.gen.ts` (regenerated)

**Interfaces:**
- Consumes: `buildDraftProduct`, `DEMO_DRAFT`, `DEMO_DRAFT_ID`, `ARTISAN` (Tasks 1–3); `localize`, `isClipId`, `AudioButton`, `LanguagePills` (Task 2).
- Produces: `Product.certId: string`; `getStaticProduct(id: string): Product | undefined`; context `getProduct(id: string): Product | undefined`; `verificationPath(id)`; `<AuthenticityQr productId size label className? />`; `<QrSheet product onClose />`; `<AuthenticityBadge productId giTag onEnlarge? />`; route `/p/$id`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/kala-store.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/lib/kala-store.test.ts`
Expected: FAIL — `getStaticProduct` is not exported.

- [ ] **Step 3: Certificate ids and static lookup**

In `src/lib/kala-store.tsx`:
1. Add `certId: string;` to `Product`.
2. Add `certId` to each seed: p1 `"HS-2026-0017"`, p2 `"HS-2026-0023"`, p3 `"HS-2026-0031"`; and to `DEMO_DRAFT`: `certId: "HS-2026-0042",`.
3. After `buildDraftProduct`:

```ts
const STATIC_PRODUCTS: Product[] = [...seedProducts, buildDraftProduct(DEMO_DRAFT.image)];

/** Products known without client state — used by the public verification page. */
export function getStaticProduct(id: string) {
  return STATIC_PRODUCTS.find((p) => p.id === id);
}
```

4. Add `getProduct: (id: string) => Product | undefined;` to `KalaContextValue`, and in the provider:

```ts
  const getProduct = useCallback(
    (id: string) => products.find((p) => p.id === id) ?? getStaticProduct(id),
    [products],
  );
```

adding `getProduct` to `value` and its dependency list.

- [ ] **Step 4: Run it to verify it passes**

Run: `bun run test src/lib/kala-store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Strings**

In `src/lib/i18n.ts` add after `"badge.authQr"` in each dictionary:

| key | en | hi | bn | ta | mr | or |
|---|---|---|---|---|---|---|
| `qr.scan` | Scan to verify | सत्यापित करने के लिए स्कैन करें | যাচাই করতে স্ক্যান করুন | சரிபார்க்க ஸ்கேன் செய்யுங்கள் | पडताळणीसाठी स्कॅन करा | ଯାଞ୍ଚ ପାଇଁ ସ୍କାନ କରନ୍ତୁ |
| `qr.open` | Open verification page | सत्यापन पेज खोलें | যাচাই পাতা খুলুন | சரிபார்ப்புப் பக்கத்தைத் திற | पडताळणी पेज उघडा | ଯାଞ୍ଚ ପୃଷ୍ଠା ଖୋଲନ୍ତୁ |
| `qr.tapToEnlarge` | Tap QR to enlarge | क्यूआर बड़ा करने के लिए दबाएँ | কিউআর বড় করতে টিপুন | க்யூஆரைப் பெரிதாக்கத் தொடுங்கள் | क्यूआर मोठा करण्यासाठी टॅप करा | କ୍ୟୁଆର ବଡ଼ କରିବାକୁ ଦବାନ୍ତୁ |
| `verify.madeBy` | Made by | निर्माता | নির্মাতা | உருவாக்கியவர் | निर्माता | ନିର୍ମାତା |
| `verify.certId` | Certificate no. | प्रमाणपत्र सं. | শংসাপত্র নং | சான்றிதழ் எண் | प्रमाणपत्र क्र. | ପ୍ରମାଣପତ୍ର ନଂ |
| `verify.checkPhoto` | Photographed at the workshop | कार्यशाला में फ़ोटो ली गई | কর্মশালায় ছবি তোলা | பட்டறையில் படம் எடுக்கப்பட்டது | कार्यशाळेत फोटो घेतला | କର୍ମଶାଳାରେ ଫଟୋ ଉଠାଯାଇଛି |
| `verify.checkGi` | GI tag checked | जीआई टैग जाँचा गया | জিআই ট্যাগ যাচাই করা | புவிசார் குறியீடு சரிபார்க்கப்பட்டது | जीआय टॅग तपासला | ଜିଆଇ ଟ୍ୟାଗ ଯାଞ୍ଚ ହୋଇଛି |
| `verify.checkCoop` | Verified by cooperative | सहकारी संस्था द्वारा सत्यापित | সমবায় দ্বারা যাচাইকৃত | கூட்டுறவு சங்கத்தால் சரிபார்க்கப்பட்டது | सहकारी संस्थेकडून पडताळले | ସମବାୟ ଦ୍ୱାରା ଯାଞ୍ଚିତ |

- [ ] **Step 6: Verification page route**

Create `src/routes/p.$id.tsx`:

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { BadgeCheck, Check, MapPin, ShieldCheck, Sparkles } from "lucide-react";

import { AudioButton } from "@/components/kala/AudioButton";
import { LanguagePills } from "@/components/kala/LanguagePills";
import { isClipId } from "@/content/narration";
import { ARTISAN, getStaticProduct, useKala } from "@/lib/kala-store";
import { localize } from "@/lib/products";

export const Route = createFileRoute("/p/$id")({
  loader: ({ params }) => {
    if (!getStaticProduct(params.id)) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Verified handmade — HunarSetu" },
      {
        name: "description",
        content: "Authenticity certificate for a handmade craft listed on HunarSetu.",
      },
    ],
  }),
  component: VerifyPage,
});

const checks = ["verify.checkPhoto", "verify.checkGi", "verify.checkCoop"] as const;

function VerifyPage() {
  const { id } = Route.useParams();
  const { getProduct, language, t } = useKala();
  const product = getProduct(id);
  if (!product) return null; // the loader already 404s unknown ids

  const copy = localize(product, language);
  const clip = `product.${product.id}`;

  return (
    <div className="canvas-texture min-h-screen">
      <div className="mx-auto min-h-screen w-full max-w-md bg-background pb-10 shadow-lift">
        <header className="sticky top-0 z-20 space-y-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
            <Sparkles className="size-3.5 shrink-0" /> {t("app.name")}
          </p>
          <LanguagePills />
        </header>

        <img
          src={product.image}
          alt={copy.title}
          width={800}
          height={800}
          className="aspect-square w-full object-cover"
        />

        <div className="space-y-4 px-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
              <MapPin className="size-3.5" /> {product.origin}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-leaf px-2.5 py-1 text-[11px] font-semibold text-leaf-foreground">
              <BadgeCheck className="size-3.5" /> {t("modal.verified")}
            </span>
          </div>

          <div>
            <h1 className="text-2xl leading-tight font-semibold">{copy.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("verify.madeBy")} {ARTISAN.name} · {product.origin}
            </p>
          </div>

          <section className="craft-card space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-5 text-leaf" /> {t("modal.certificate")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("verify.certId")}{" "}
              <span className="font-mono font-semibold text-foreground">{product.certId}</span> ·{" "}
              {product.giTag}
            </p>
            <ul className="space-y-2">
              {checks.map((key) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-leaf text-leaf-foreground">
                    <Check className="size-3.5" />
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>
          </section>

          <section className="craft-card space-y-3 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <p className="min-w-0 text-sm font-semibold">{t("modal.makerStory")}</p>
              {isClipId(clip) && <AudioButton clips={[clip]} label={t("common.play")} />}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.story}</p>
            <p className="text-xs text-muted-foreground">
              {t("modal.materials")}: {product.materials.join(", ")} · {t("modal.madeIn")}{" "}
              {product.labourHours} {t("modal.handHours")}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
```

Regenerate the route tree: run `bun run build` (the router plugin rewrites `src/routeTree.gen.ts`). Expected: build succeeds and `git diff --stat src/routeTree.gen.ts` shows `/p/$id` added.

- [ ] **Step 7: QR component and sheet**

```bash
bun add qrcode && bun add -d @types/qrcode
```

Create `src/components/kala/AuthenticityQr.tsx`:

```tsx
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export const verificationPath = (productId: string) => `/p/${productId}`;

/** Real, scannable QR for the product's verification page (rendered client-side). */
export function AuthenticityQr({
  productId,
  size,
  label,
  className,
}: {
  productId: string;
  size: number;
  label: string;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toString(`${window.location.origin}${verificationPath(productId)}`, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#27336b", light: "#ffffff" },
    }).then((markup) => {
      if (active) setSvg(markup);
    });
    return () => {
      active = false;
    };
  }, [productId]);

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("block [&>svg]:size-full", !svg && "rounded bg-secondary", className)}
      style={{ width: size, height: size }}
      {...(svg ? { dangerouslySetInnerHTML: { __html: svg } } : {})}
    />
  );
}
```

Create `src/components/kala/QrSheet.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { ExternalLink, X } from "lucide-react";

import { AuthenticityQr } from "@/components/kala/AuthenticityQr";
import { useKala, type Product } from "@/lib/kala-store";
import { localize } from "@/lib/products";

export function QrSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const { language, t } = useKala();
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/60 px-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs space-y-4 rounded-3xl bg-background p-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t("qr.scan")}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("modal.close")}
            className="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mx-auto w-fit rounded-2xl bg-white p-3">
          <AuthenticityQr productId={product.id} size={208} label={t("qr.scan")} />
        </div>
        <div>
          <p className="text-sm font-semibold">{localize(product, language).title}</p>
          <p className="text-xs text-muted-foreground">
            {t("verify.certId")} <span className="font-mono">{product.certId}</span>
          </p>
        </div>
        <Link
          to="/p/$id"
          params={{ id: product.id }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
        >
          <ExternalLink className="size-4" /> {t("qr.open")}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Real QR in the badge**

Replace `AuthenticityBadge` in `src/components/kala/shared.tsx` (remove `QrCode` from the lucide import; import `AuthenticityQr` from `@/components/kala/AuthenticityQr`):

```tsx
export function AuthenticityBadge({
  productId,
  giTag,
  onEnlarge,
}: {
  productId: string;
  giTag: string;
  onEnlarge?: () => void;
}) {
  const { t } = useKala();
  const qr = <AuthenticityQr productId={productId} size={40} label={t("qr.scan")} />;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-canvas px-2.5 py-2">
      {onEnlarge ? (
        <button
          type="button"
          onClick={onEnlarge}
          aria-label={t("qr.tapToEnlarge")}
          className="shrink-0 rounded bg-white p-0.5"
        >
          {qr}
        </button>
      ) : (
        <span className="shrink-0 rounded bg-white p-0.5">{qr}</span>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-foreground">{t("badge.authQr")}</p>
        <p className="truncate text-[10px] text-muted-foreground">{giTag}</p>
        {onEnlarge && <p className="text-[10px] font-semibold text-primary">{t("qr.tapToEnlarge")}</p>}
      </div>
    </div>
  );
}
```

`src/routes/catalog.tsx`: `<AuthenticityBadge productId={p.id} giTag={p.giTag} />` (non-interactive; the card is the button).

`src/components/kala/ProductModal.tsx`:
- Add `import { useEffect, useState } from "react";` and `import { QrSheet } from "@/components/kala/QrSheet";`.
- Before `if (!product) return null;` add:

```tsx
  const [qrOpen, setQrOpen] = useState(false);
  useEffect(() => setQrOpen(false), [product]);
```

- Change the badge to `<AuthenticityBadge productId={product.id} giTag={product.giTag} onEnlarge={() => setQrOpen(true)} />`.
- Just before the component's final closing `</div>` add `{qrOpen && <QrSheet product={product} onClose={() => setQrOpen(false)} />}`.

- [ ] **Step 9: Type-check and test**

Run: `npx tsc --noEmit && bun run test`
Expected: no errors; all tests PASS.

- [ ] **Step 10: Verify the QR scans**

With the dev server running, open `/catalog`, open the shawl and tap the QR. Point a phone camera at the sheet on the laptop screen — the phone must recognise it and show `http://localhost:<port>/p/p2`. (The phone cannot open localhost; the video opens the page on the laptop via the button.) If the phone does not recognise the code, raise `size` in `QrSheet` and re-check.

- [ ] **Step 11: Commit**

```bash
npx prettier --write 'src/routes/p.$id.tsx' src/components/kala/AuthenticityQr.tsx src/components/kala/QrSheet.tsx src/components/kala/shared.tsx src/components/kala/ProductModal.tsx src/routes/catalog.tsx src/lib/kala-store.tsx src/lib/kala-store.test.ts src/lib/i18n.ts
git add -A && git commit -m "Add scannable authenticity QR and verification page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 12: Verify in the browser (Review Focus 3 and 5)**

At 375×812:
- Studio → clean → record → publish → Open catalog → the new pot card shows a real QR → open it → tap the QR → sheet shows a large QR, "HS-2026-0042" → Open verification page → `/p/p4` shows the cleaned pot, "Made by Rekha Devi", the three ticks, and the story plays.
- Switch language on `/p/p4` → title, story and ticks change language.
- Hard-reload `/p/p4` → page still renders. Open `/p/unknown` → 404 page.
- Hard-reload `/`, `/catalog`, `/orders`, `/p/p1` → console shows no hydration or `window is not defined` errors.

---

### Task 5: Regenerate narration with Sarvam voices

**Files:**
- Create: `.env.local` (user-created, git-ignored)
- Modify: `public/audio/**`, `src/content/audio-manifest.json`

**Interfaces:**
- Consumes: `scripts/generate-audio.ts` (Task 2).

- [ ] **Step 1: User adds the key**

Ask the user to create `.env.local` in the project root containing `SARVAM_API_KEY=<their key>` (they type it into the file themselves; do not ask for it in chat). Confirm with `git check-ignore .env.local` → prints `.env.local`.

- [ ] **Step 2: Try one clip first**

Temporarily verify the API accepts the request before spending credits on all 84: run `bun run audio -- --provider sarvam` and stop it (Ctrl-C) after the first `✓` line. Expected: `public/audio/en/product.p1.mp3` exists and plays (`afplay public/audio/en/product.p1.mp3`). If Sarvam rejects `output_audio_codec` or the speaker, read the error body, adjust `SARVAM_MODEL`/`SARVAM_SPEAKER` or drop `output_audio_codec` (then set `ext` to `"wav"`), and retry.

- [ ] **Step 3: Generate all clips**

Run: `bun run audio -- --provider sarvam`
Expected: remaining clips generated (84 total, 0 unsupported); old `.m4a` files removed.

- [ ] **Step 4: Run the tests**

Run: `bun run test`
Expected: all PASS with no "No voice for" warning.

- [ ] **Step 5: Spot-check with the user**

Ask the user (or a native speaker) to listen in the browser to Hindi and the second featured language: the Studio guide, one product story, "Hear order" and one step clip. Fix any mistranslation in `src/content/narration.ts` and re-run `bun run audio -- --provider sarvam` (only changed clips regenerate).

- [ ] **Step 6: Commit**

```bash
git add public/audio src/content/audio-manifest.json src/content/narration.ts
git commit -m "Regenerate narration with Sarvam voices for all six languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Final verification and PR

**Files:** none new.

- [ ] **Step 1: Full checks**

Run: `npx tsc --noEmit && bun run test && bun run build`
Expected: no type errors, all tests pass, build succeeds.

- [ ] **Step 2: Production preview**

Run `bun run preview` and repeat the browser checks from Task 1 Step 9, Task 2 Step 14, Task 3 Step 11 and Task 4 Step 12 against the production build.

- [ ] **Step 3: SSR sanity (Review Focus 5)**

Hard-reload each route in the preview and read the console: no errors or warnings about hydration mismatches.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin round2-polish
gh pr create --base main --title "Round 2 polish: narration, clean backgrounds, authenticity QR, dispatch tracker" --body-file <(cat <<'EOF'
## What changed
- Local-language narration (6 languages) for product stories, order instructions and a per-screen guide; audio pre-generated by `scripts/generate-audio.ts`.
- Background cleanup from the raw photo via an open-source segmentation model; product pixels are copied verbatim and a test proves it.
- Scannable authenticity QR, QR sheet and a public verification page at `/p/:id`.
- Dispatch tracker advances, speaks each step and settles payouts.

## Why
Polish for the SIH Round 2 recorded video. Spec: `docs/superpowers/specs/2026-09-27-round2-polish-design.md`.

## Reviewer notes
- Translations are machine-authored; Hindi and the featured language were spot-checked.
- Page reload restores demo state (used for retakes).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
```

Then bind/check the PR with the app's PR tools and report the URL.
