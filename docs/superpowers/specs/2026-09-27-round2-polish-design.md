# HunarSetu — SIH Round 2 polish: design

Date: 2026-09-27 · Status: awaiting review · Branch: `round2-polish`

## 1. Context and goal

HunarSetu passed the SIH internal round. Round 2 is a **recorded video** uploaded to the
portal. This work polishes the PoC for that video.

- **Audience:** SIH judges watching a 2–3 minute screen recording.
- **Reliability over realism:** anything may be pre-computed or scripted; nothing needs to
  work with live user input. Takes can be re-recorded; a page reload restores the demo state.
- **No backend, no hosting.** Everything runs client-side from bundled assets. The video
  is recorded in a mobile-sized browser window.

### Success criteria

1. Every feature below works first time on camera, offline, with no network calls at runtime.
2. Narration sounds natural in at least Hindi plus one other language (Sarvam voices).
3. The claim "the AI never alters the product" is literally true and backed by a test: every
   product pixel in the cleaned image equals the raw photo.

### In scope

1. Local-language audio narration (product stories, order instructions, per-screen guide).
2. Background cleanup that never morphs the product (one prepared photo: the pot).
3. Scannable authenticity QR + public verification page.
4. Working dispatch tracker with spoken steps and payout settlement.

### Out of scope

Real speech-to-text / voice-to-listing, user photo uploads, hosting/deploying, translating
category/technique/material labels, backend or persistence, other crafts' raw photos.

## 2. Existing code (baseline)

TanStack Start + React 19 + Tailwind v4 app. All state lives in `KalaProvider`
(`src/lib/kala-store.tsx`); UI strings in `src/lib/i18n.ts` for `en, hi, bn, ta, mr, or`.
Routes: `/` Studio, `/catalog`, `/orders`. Known defects this work fixes:

- The "AI background" toggle swaps the raw plain pot (`craft-raw.jpg`) for a *different*,
  hand-painted pot (`craft-pottery.jpg`) — exactly the morphing we must avoid.
- `advanceOrder` is a no-op and `orders` has no setter; the tracker never moves.
- Publishing twice adds duplicate listings.
- `SpeakButton` uses browser `speechSynthesis` with no language set; Indic voices are
  unreliable across devices.

## 3. Feature: local-language narration

### 3.1 Clips

Fourteen clips × six languages = 84 audio files.

| Clip id | Count | Content |
|---|---|---|
| `product.p1` … `product.p4` | 4 | Localized "Title. Story." for each product (p4 = the Studio's new listing) |
| `screen.studio`, `screen.catalog`, `screen.orders` | 3 | "What's on this screen?" guide, ~2 sentences, action-oriented |
| `order.KL-4471`, `order.KL-4468`, `order.KL-4460` | 3 | "Order from {buyer}, {city}. Payout {amount} rupees." |
| `step.0` … `step.3` | 4 | Status + next action, shared by all orders: 0 "Next, pack the item." · 1 "Packed! Next, stick the label." · 2 "Label done! Next, hand it to the courier." · 3 "Handed over! Your payout is on its way." |

"Hear order" plays `order.<id>` then `step.<current>` back-to-back. Advancing a step plays
`step.<new>` only.

### 3.2 Content file — `src/content/narration.ts`

```ts
export type ClipId = "product.p1" | ... | "step.3";
export const narration: Record<ClipId, Record<LanguageCode, string>>;
export const localizedProducts: Record<string, Partial<Record<LanguageCode, { title: string; story: string }>>>;
```

- Claude authors all non-English text. A native speaker spot-checks Hindi and whichever
  language features in the video.
- On-screen product **title and story** follow the selected language (catalog grid, modal,
  Studio listing card, verification page) via a helper
  `localize(product, language) → { title, story }` that falls back to the English fields.
  The spoken audio and visible text therefore always match.

### 3.3 Generator — `scripts/generate-audio.mjs` (dev-time only)

- Reads `narration.ts`, writes `public/audio/<lang>/<clipId>.<ext>` and
  `src/content/audio-manifest.json`:
  `{ provider, unsupported: LanguageCode[], clips: { [clipId]: { [lang]: { file, hash } } } }`.
- `hash` = sha1 of text + provider + voice; unchanged clips are skipped, so fixing one
  translation regenerates one file.
- **Provider `sarvam` (target):** `POST https://api.sarvam.ai/text-to-speech`, header
  `api-subscription-key`, model `bulbul:v2`/`v3`, `language_code` `en-IN, hi-IN, bn-IN,
  ta-IN, mr-IN, od-IN`, `output_audio_codec: "mp3"`; response `audios[0]` is base64.
  Key read from `.env.local` (`SARVAM_API_KEY`), which is git-ignored (`*.local`).
- **Provider `mac` (interim fallback):** `say -v <voice> -o x.aiff` then
  `afconvert -f m4af -d aac` → `.m4a`. Voices: en Aman (en_IN), hi Lekha,
  bn Piya, ta Vani, mr Lekha (reads Devanagari). **Odia unsupported** → listed in
  `manifest.unsupported`.
- Usage: `node scripts/generate-audio.mjs --provider sarvam|mac [--force]`.

### 3.4 Playback — `src/lib/narrator.tsx`

- `NarratorProvider` (mounted in `__root.tsx` inside `KalaProvider`) owns a single
  `HTMLAudioElement`. API: `play(clipIds: ClipId[])` plays a queue in the current language;
  `stop()`; `playingKey` (the first clip id of the active queue, or `null`).
- Starting any new playback stops the current one. Changing language stops playback.
- Fallback when a clip file is absent from the manifest: `speechSynthesis` with
  `utterance.lang` set to the BCP-47 tag (e.g. `hi-IN`); if unavailable, do nothing.
- `AudioButton` (`src/components/kala/AudioButton.tsx`) replaces `SpeakButton`. Props:
  `clips: ClipId[]`, optional `label`. While its queue plays it shows animated sound bars
  and reads "Stop"; tapping stops. `speak()`/`SpeakButton` are deleted.
- **Screen guide:** `AppShell` gets a `screen: "studio" | "catalog" | "orders"` prop and
  renders a circular speaker button (label "What's on this screen?" via i18n) at the right
  of the language-pill row, playing `screen.<screen>`.

## 4. Feature: background cleanup that never morphs the product

### 4.1 Pipeline — `scripts/clean-backgrounds.mjs` (dev-time only)

Input: `src/assets/craft-raw.jpg` (800×800). Dev dependencies:
`@imgly/background-removal-node` (open-source segmentation model, runs locally; its
licence applies to the script only, not to the output images) and `sharp`.

1. Run segmentation → alpha matte for the pot.
2. **`src/assets/clean/pot-cutout.png`** — the raw photo's RGB with the model's alpha.
   Pixels are copied from the raw photo, never generated.
3. **Backgrounds (same 800×800 framing, no product):** `bg-studio.jpg` (soft radial
   white-grey), `bg-linen.jpg` (warm beige with fine woven noise), `bg-indigo.jpg`
   (deep indigo gradient). Each includes a soft elliptical contact shadow derived from the
   matte's bottom edge. Background-only sharpening/brightening happens here.
4. **Composites** `pot-studio.webp`, `pot-linen.webp`, `pot-indigo.webp` = background +
   cutout, written as **lossless WebP** (JPEG would alter product pixels), used where a
   single image is needed (catalog, modal, verification page).
5. **`pot-mask.png`** — white-on-transparent matte used for the outline trace animation.

**Invariant:** for every pixel where the matte alpha is 255, the composite's RGB equals the
raw photo's RGB. Partially transparent edge pixels are blended; that is the only area where
background and product mix. Framing is identical across all outputs so the before/after
slider lines up exactly.

### 4.2 Studio UI (`src/routes/index.tsx` + new components)

- Photo area renders layers: background image → cutout PNG. **Auto enhance** applies CSS
  filters to the background layer only; the cutout layer is never filtered.
- Tapping **AI background** (first time): ~1.5 s reveal — a shimmer sweeps top-to-bottom
  over the raw photo with a "Finding your product…" label, the mask outline glows briefly,
  then the cleaned layers (studio background + cutout) fade in. Subsequent taps toggle raw/clean instantly.
- **Background swatches** (studio / linen / indigo) appear below the photo once cleaned.
- **Before/after slider** (`BeforeAfterSlider.tsx`): draggable vertical handle; raw photo
  on the left, cleaned on the right. Pointer + touch events; keyboard arrows for a11y.
- Tag on the cleaned image: "Product pixels unchanged ✓" (i18n).
- The new listing's image is the cleaned pot composite in the chosen style, so the listing
  shows the same object that was photographed. The draft copy is rewritten to describe this
  plain wheel-thrown pot (no painted motif).
- `craft-pottery.jpg` remains only as seed product p1's image.

## 5. Feature: authenticity QR and verification page

### 5.1 Data changes (`kala-store.tsx`)

- `Product` gains `certId: string` (e.g. `HS-2026-0042`).
- An `ARTISAN` constant: name "Rekha Devi", region, UPI handle — replaces hard-coded "RD"
  and the UPI string's handle.
- The Studio draft moves into the store as `DEMO_DRAFT` with fixed id **`p4`**.
  `addProduct` upserts by id, so publishing twice never duplicates.
- `getProduct(id)` returns the product from state, else from the static list
  `[...seedProducts, DEMO_DRAFT_AS_PRODUCT]`, so `/p/p4` works after a reload.

### 5.2 QR component

- `AuthenticityQr.tsx` renders an SVG via the `qrcode` package (MIT), encoding
  `${window.location.origin}/p/${id}`; generated client-side in an effect (a neutral
  placeholder renders during SSR).
- `AuthenticityBadge` shows the real QR (small) instead of the Lucide icon. On catalog
  cards it is non-interactive (the card itself is the button).
- In `ProductModal`'s certificate block, tapping the QR opens a **QR sheet**: large code,
  "Scan to verify", cert ID, and an **Open verification page** link to `/p/<id>`.

### 5.3 Verification page — `src/routes/p.$id.tsx` → `/p/:id`

Buyer-facing, no artisan tab bar. Compact header with HunarSetu mark and language pills.
Content: studio photo; maker name and region; GI tag; **"Verified handmade"** certificate
with `certId` and a checklist (photographed at workshop · GI tag checked · verified by
cooperative); materials and hand-hours; localized story with an `AudioButton` for
`product.<id>`. Unknown id → the existing not-found component.

## 6. Feature: dispatch tracker and payouts

- `orders` becomes state. A pure function `advanceStep(orders, id)` (in
  `src/lib/orders.ts`) increments `step` by one, capped at 3; `advanceOrder` wraps it.
- Each order card shows one full-width **next-action button**: "Mark packed" /
  "Mark labelled" / "Hand over to courier"; hidden when `step === 3` (shows a "Delivered to
  courier" chip instead).
- On tap: step advances; the step cell fills with a tick and the connector line grows
  (CSS transition); `step.<new>` plays in the selected language.
- On reaching step 3: that payout moves from Pending to Paid; both totals animate with a
  count-up (`useCountUp` hook, ~600 ms); a toast "₹3,200 sent to UPI rekha@upi" appears
  (sonner `Toaster` mounted in `__root.tsx`); the "last transfer" line shows this
  order's amount. `orders.lastTransfer` becomes a template with `{amount}` and `{upi}`.
- Page reload restores seed state — the retake mechanism.

## 7. Testing and verification

Add **Vitest** with a standalone `vitest.config.ts` (tsconfig paths only; not the
TanStack Start plugin). Script: `npm test`.

| Test | Asserts |
|---|---|
| `narration.test.ts` | Every clip has non-empty text in all 6 languages; every clip × language has a manifest entry whose file exists in `public/audio`, except languages in `manifest.unsupported` (printed as a warning). |
| `orders.test.ts` | `advanceStep` increments by one, caps at 3, leaves other orders untouched; pending/paid totals derive correctly. |
| `background.test.ts` | Using `sharp`: for every pixel with cutout alpha 255, `pot-cutout.png` and each lossless-WebP composite have RGB exactly equal to the decoded `craft-raw.jpg`. All outputs are 800×800. |

Plus a manual pass per feature in the built-in browser at mobile viewport (375×812):
screenshots of each state, console free of errors, and `npx tsc --noEmit` clean.

## 8. Build order

All on branch `round2-polish`, one commit (or more) per step, one PR at the end.

1. Vitest setup + dispatch tracker and payouts.
2. Narration: content, manifest, `NarratorProvider`/`AudioButton`, screen guide, generator,
   first generation with the `mac` provider.
3. Background pipeline + Studio UI (reveal, swatches, slider, draft rewrite).
4. QR component, QR sheet, verification page, `p4` upsert.
5. Regenerate audio with `sarvam` once the user supplies `SARVAM_API_KEY`.
6. Optional: shot list for the 2–3 minute video.

## 9. Risks

- **Translation quality** — machine-authored; mitigated by native-speaker spot check of the
  languages shown in the video.
- **Segmentation edge quality** on the busy workshop photo — mitigated by reviewing the
  cutout; if the rim or base is clipped, tune the model's threshold or hand-correct the
  matte (the invariant still holds because product pixels still come from the raw photo).
- **Sarvam key delay** — Mac voices keep everything working; Odia plays the
  `speechSynthesis` fallback (likely silent) until then, so the video should not feature
  Odia before regeneration.
