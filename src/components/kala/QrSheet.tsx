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
