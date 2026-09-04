import { QrCode, Volume2 } from "lucide-react";

import type { ProductStatus } from "@/lib/kala-store";
import { cn } from "@/lib/utils";

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

export function SpeakButton({
  text,
  label = "Listen",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={`${label}: ${text.slice(0, 40)}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-indigo px-3 py-2 text-xs font-semibold text-indigo-foreground active:scale-95",
        className,
      )}
    >
      <Volume2 className="size-4" />
      {label}
    </button>
  );
}

const statusStyles: Record<ProductStatus, string> = {
  listed: "bg-leaf text-leaf-foreground",
  pending: "bg-turmeric text-turmeric-foreground",
  sold: "bg-secondary text-secondary-foreground",
};

const statusLabel: Record<ProductStatus, string> = {
  listed: "Listed",
  pending: "Pending buyer",
  sold: "Sold",
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        statusStyles[status],
      )}
    >
      {statusLabel[status]}
    </span>
  );
}

export function AuthenticityBadge({ giTag }: { giTag: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-canvas px-2.5 py-2">
      <QrCode className="size-7 shrink-0 text-indigo" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-foreground">Authenticity QR</p>
        <p className="truncate text-[10px] text-muted-foreground">{giTag}</p>
      </div>
    </div>
  );
}
