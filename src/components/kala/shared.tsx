import { AuthenticityQr } from "@/components/kala/AuthenticityQr";
import { useKala, type ProductStatus } from "@/lib/kala-store";
import type { TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const statusStyles: Record<ProductStatus, string> = {
  listed: "bg-leaf text-leaf-foreground",
  pending: "bg-turmeric text-turmeric-foreground",
  sold: "bg-secondary text-secondary-foreground",
};

const statusKey: Record<ProductStatus, TranslationKey> = {
  listed: "status.listed",
  pending: "status.pending",
  sold: "status.sold",
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  const { t } = useKala();
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        statusStyles[status],
      )}
    >
      {t(statusKey[status])}
    </span>
  );
}

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
        {onEnlarge && (
          <p className="text-[10px] font-semibold text-primary">{t("qr.tapToEnlarge")}</p>
        )}
      </div>
    </div>
  );
}
