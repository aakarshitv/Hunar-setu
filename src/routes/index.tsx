import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Check, Coins, ImagePlus, Mic, Sparkles, Wand2, Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/kala/AppShell";
import { AudioButton } from "@/components/kala/AudioButton";
import { BeforeAfterSlider } from "@/components/kala/BeforeAfterSlider";
import { CleanPhoto } from "@/components/kala/CleanPhoto";
import { ProductModal } from "@/components/kala/ProductModal";
import { ScanOverlay } from "@/components/kala/ScanOverlay";
import { BG_STYLES, CLEAN, type BgStyle } from "@/lib/clean-assets";
import {
  DEMO_DRAFT,
  DEMO_DRAFT_ID,
  rupees,
  suggestedPrice,
  useKala,
  type Product,
} from "@/lib/kala-store";
import { localize } from "@/lib/products";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HunarSetu — Artisan Studio & Market Linkage" },
      {
        name: "description",
        content:
          "Photograph a craft, speak its story, and HunarSetu builds a fair-priced listing that syncs to ONDC, cooperatives and export buyers.",
      },
      { property: "og:title", content: "HunarSetu — Artisan Studio" },
      {
        property: "og:description",
        content: "Voice-first smart cataloging and fair price estimates for marginalized artisans.",
      },
    ],
  }),
  component: StudioPage,
});

type Phase = "raw" | "scanning" | "clean";
const REVEAL_MS = 1500;
const bgLabelKey = {
  studio: "studio.bgStudio",
  linen: "studio.bgLinen",
  indigo: "studio.bgIndigo",
} as const;

function StudioPage() {
  const { publishDraft, language, t } = useKala();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("raw");
  const [bgStyle, setBgStyle] = useState<BgStyle>("studio");
  const revealed = useRef(false);
  const cleaned = phase === "clean";
  const [enhanced, setEnhanced] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [analysed, setAnalysed] = useState(false);
  const [published, setPublished] = useState<Product | null>(null);
  const [preview, setPreview] = useState<Product | null>(null);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const copy = localize(
    { id: DEMO_DRAFT_ID, title: DEMO_DRAFT.title, story: DEMO_DRAFT.story },
    language,
  );
  const price = suggestedPrice(DEMO_DRAFT);
  const labour = DEMO_DRAFT.labourHours * DEMO_DRAFT.hourlyRate;

  const stopRecording = () => {
    setRecording(false);
    setAnalysed(true);
  };

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

  const publish = () => setPublished(publishDraft(CLEAN.composites[bgStyle]));

  return (
    <AppShell screen="studio" title={t("studio.title")} subtitle={t("studio.subtitle")}>
      <section className="craft-card overflow-hidden">
        <div className="relative aspect-square">
          {cleaned ? (
            <BeforeAfterSlider
              before={
                <img
                  src={CLEAN.raw}
                  alt="Raw workshop photo of the pot"
                  draggable={false}
                  className="size-full object-cover"
                />
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

        <div className="space-y-3 p-4">
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
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl border border-dashed border-border text-muted-foreground",
                  i === 0 && "border-solid border-primary bg-accent text-primary",
                )}
              >
                {i === 0 ? <Check className="size-6" /> : <ImagePlus className="size-6" />}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleClean}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold",
                phase !== "raw"
                  ? "bg-indigo text-indigo-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              <Wand2 className="size-4" /> {t("studio.aiBackground")}
            </button>
            <button
              type="button"
              onClick={() => setEnhanced((v) => !v)}
              disabled={!cleaned}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold disabled:opacity-50",
                enhanced
                  ? "bg-indigo text-indigo-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              <Sparkles className="size-4" /> {t("studio.autoEnhance")}
            </button>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-xs font-semibold"
          >
            <Camera className="size-4" /> {t("studio.takePhoto")}
          </button>
        </div>
      </section>

      <section className="craft-card flex flex-col items-center gap-3 p-5 text-center">
        <p className="text-sm font-semibold">{t("studio.speak")}</p>
        <div className="relative grid place-items-center">
          {recording && <span className="pulse-ring absolute size-24 rounded-full bg-primary/40" />}
          <button
            type="button"
            onClick={() => (recording ? stopRecording() : (setSeconds(0), setRecording(true)))}
            aria-label={recording ? t("studio.listening") : t("studio.speak")}
            className={cn(
              "relative grid size-24 place-items-center rounded-full text-primary-foreground active:scale-95",
              recording ? "bg-destructive" : "bg-primary",
            )}
          >
            <Mic className="size-10" />
          </button>
        </div>

        <div className="flex h-10 items-end gap-1">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "w-1.5 rounded-full bg-primary/70",
                recording ? "wave-bar h-8" : "h-2 bg-border",
              )}
              style={recording ? { animationDelay: `${i * 70}ms` } : undefined}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {recording
            ? `${t("studio.listening")} ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
            : analysed
              ? t("studio.understood")
              : t("studio.tapMic")}
        </p>
      </section>

      {analysed && (
        <section className="craft-card space-y-4 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h2 className="min-w-0 truncate text-base font-semibold">{t("studio.listing")}</h2>
            <AudioButton clips={["product.p4"]} />
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-lg leading-tight font-semibold">{copy.title}</p>
            <p className="text-xs text-muted-foreground">{DEMO_DRAFT.category}</p>
            <dl className="grid grid-cols-1 gap-2 pt-1">
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-[11px] font-semibold text-muted-foreground">
                  {t("studio.technique")}
                </dt>
                <dd className="text-sm">{DEMO_DRAFT.technique}</dd>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-[11px] font-semibold text-muted-foreground">
                  {t("studio.materials")}
                </dt>
                <dd className="text-sm">{DEMO_DRAFT.materials.join(" · ")}</dd>
              </div>
              <div className="rounded-xl bg-accent p-3">
                <dt className="text-[11px] font-semibold text-accent-foreground">
                  {t("studio.story")}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed">{copy.story}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Coins className="size-4 text-primary" /> {t("studio.fairPrice")}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("studio.materialCost")}</span>
                <span className="font-medium">{rupees(DEMO_DRAFT.materialCost)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("studio.labour")} · {DEMO_DRAFT.labourHours} {t("common.hrs")} ×{" "}
                  {rupees(DEMO_DRAFT.hourlyRate)}/hr
                </span>
                <span className="font-medium">{rupees(labour)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("studio.benchmark")}</span>
                <span className="font-medium">{rupees(DEMO_DRAFT.benchmark)}</span>
              </li>
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-primary/25 pt-3">
              <span className="text-sm font-semibold">{t("studio.suggested")}</span>
              <span className="text-2xl font-semibold text-primary">{rupees(price)}</span>
            </div>
          </div>

          {published ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 rounded-xl bg-leaf/15 px-3 py-3 text-sm font-semibold">
                <Check className="size-4 text-leaf" /> {t("studio.published")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreview(published)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-semibold text-secondary-foreground"
                >
                  <Eye className="size-4" /> {t("studio.buyerView")}
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/catalog" })}
                  className="rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  {t("studio.openCatalog")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={publish}
              className="w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground active:scale-[0.99]"
            >
              {t("studio.publish")}
            </button>
          )}
        </section>
      )}

      <ProductModal product={preview} onClose={() => setPreview(null)} />
    </AppShell>
  );
}
