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
