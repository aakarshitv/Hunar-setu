import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  Check,
  Coins,
  ImagePlus,
  Mic,
  Sparkles,
  Wand2,
  Eye,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/kala/AppShell";
import { ProductModal } from "@/components/kala/ProductModal";
import { SpeakButton } from "@/components/kala/shared";
import {
  rupees,
  suggestedPrice,
  useKala,
  type NewProductInput,
  type Product,
} from "@/lib/kala-store";
import { cn } from "@/lib/utils";

import rawShot from "@/assets/craft-raw.jpg";
import cleanShot from "@/assets/craft-pottery.jpg";

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

const draft: NewProductInput = {
  title: "Hand-painted Terracotta Storage Jar",
  category: "Pottery & Clay",
  technique: "Wheel-thrown, sun-dried, kiln-fired",
  materials: ["River clay", "Red oxide", "Natural lacquer"],
  story:
    "Turned on a village wheel from clay lifted out of the riverbed after the rains. The wide belly keeps grain cool through summer, and the banded motif is the pattern this family has painted on storage jars for four generations.",
  image: cleanShot,
  materialCost: 220,
  labourHours: 7,
  hourlyRate: 125,
  benchmark: 610,
  stock: 5,
  origin: "Kutch, Gujarat",
  giTag: "GI: Khavda Pottery",
};

function StudioPage() {
  const { addProduct, t } = useKala();
  const navigate = useNavigate();

  const [cleaned, setCleaned] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [analysed, setAnalysed] = useState(false);
  const [published, setPublished] = useState<Product | null>(null);
  const [preview, setPreview] = useState<Product | null>(null);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const price = suggestedPrice(draft);
  const labour = draft.labourHours * draft.hourlyRate;

  const stopRecording = () => {
    setRecording(false);
    setAnalysed(true);
  };

  const publish = () => {
    const product = addProduct(draft);
    setPublished(product);
  };

  return (
    <AppShell title={t("studio.title")} subtitle={t("studio.subtitle")}>
      <section className="craft-card overflow-hidden">
        <div className="relative">
          <img
            src={cleaned ? cleanShot : rawShot}
            alt={cleaned ? "Craft on clean studio background" : "Raw workshop photo of the craft"}
            width={800}
            height={800}
            className={cn(
              "aspect-square w-full object-cover transition-all duration-500",
              enhanced && "contrast-110 saturate-125 brightness-105",
            )}
          />
          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold">
            {cleaned ? t("studio.studioShot") : t("studio.yourPhoto")}
          </span>
        </div>

        <div className="space-y-3 p-4">
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
              onClick={() => setCleaned((v) => !v)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold",
                cleaned ? "bg-indigo text-indigo-foreground" : "bg-secondary text-secondary-foreground",
              )}
            >
              <Wand2 className="size-4" /> {t("studio.aiBackground")}
            </button>
            <button
              type="button"
              onClick={() => setEnhanced((v) => !v)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold",
                enhanced ? "bg-indigo text-indigo-foreground" : "bg-secondary text-secondary-foreground",
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
          {recording && (
            <span className="pulse-ring absolute size-24 rounded-full bg-primary/40" />
          )}
          <button
            type="button"
            onClick={() => (recording ? stopRecording() : (setSeconds(0), setRecording(true)))}
            aria-label={recording ? "Stop recording" : "Start recording"}
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
            <SpeakButton text={`${draft.title}. ${draft.story}`} />
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-lg leading-tight font-semibold">{draft.title}</p>
            <p className="text-xs text-muted-foreground">{draft.category}</p>
            <dl className="grid grid-cols-1 gap-2 pt-1">
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-[11px] font-semibold text-muted-foreground">
                  {t("studio.technique")}
                </dt>
                <dd className="text-sm">{draft.technique}</dd>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-[11px] font-semibold text-muted-foreground">
                  {t("studio.materials")}
                </dt>
                <dd className="text-sm">{draft.materials.join(" · ")}</dd>
              </div>
              <div className="rounded-xl bg-accent p-3">
                <dt className="text-[11px] font-semibold text-accent-foreground">
                  {t("studio.story")}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed">{draft.story}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Coins className="size-4 text-primary" /> Fair price estimator
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Material cost</span>
                <span className="font-medium">{rupees(draft.materialCost)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Labour · {draft.labourHours} hrs × {rupees(draft.hourlyRate)}/hr
                </span>
                <span className="font-medium">{rupees(labour)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Fair market benchmark</span>
                <span className="font-medium">{rupees(draft.benchmark)}</span>
              </li>
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-primary/25 pt-3">
              <span className="text-sm font-semibold">Suggested price</span>
              <span className="text-2xl font-semibold text-primary">{rupees(price)}</span>
            </div>
          </div>

          {published ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 rounded-xl bg-leaf/15 px-3 py-3 text-sm font-semibold">
                <Check className="size-4 text-leaf" /> Published to your catalog
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreview(published)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-semibold text-secondary-foreground"
                >
                  <Eye className="size-4" /> Buyer view
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/catalog" })}
                  className="rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  Open catalog
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={publish}
              className="w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground active:scale-[0.99]"
            >
              Publish listing
            </button>
          )}
        </section>
      )}

      <ProductModal product={preview} onClose={() => setPreview(null)} />
    </AppShell>
  );
}
