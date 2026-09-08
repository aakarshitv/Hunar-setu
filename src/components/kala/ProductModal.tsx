import { BadgeCheck, MapPin, MessageSquareHeart, ShieldCheck, X } from "lucide-react";

import { rupees, useKala, type Product } from "@/lib/kala-store";
import { AuthenticityBadge, SpeakButton } from "@/components/kala/shared";

export function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t } = useKala();
  if (!product) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 px-0 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background pb-8">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 px-4 py-3 backdrop-blur">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {t("modal.buyerView")}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("modal.close")}
            className="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
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
            <h2 className="text-2xl leading-tight font-semibold">{product.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.category} · {product.technique}
            </p>
            <p className="mt-3 text-3xl font-semibold text-primary">{rupees(product.price)}</p>
          </div>

          <div className="craft-card space-y-3 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <p className="min-w-0 text-sm font-semibold">{t("modal.makerStory")}</p>
              <SpeakButton text={product.story} label={t("common.play")} />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{product.story}</p>
          </div>

          <div className="craft-card space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-indigo" /> {t("modal.certificate")}
            </p>
            <AuthenticityBadge giTag={product.giTag} />
            <p className="text-xs text-muted-foreground">
              {t("modal.materials")}: {product.materials.join(", ")} · {t("modal.madeIn")}{" "}
              {product.labourHours} {t("modal.handHours")}
            </p>
          </div>

          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground active:scale-[0.99]"
          >
            <MessageSquareHeart className="size-5" /> {t("modal.inquire")}
          </button>
        </div>
      </div>
    </div>
  );
}
