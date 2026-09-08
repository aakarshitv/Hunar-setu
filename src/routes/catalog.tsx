import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Layers, RefreshCw } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/kala/AppShell";
import { ProductModal } from "@/components/kala/ProductModal";
import { AuthenticityBadge, StatusBadge } from "@/components/kala/shared";
import { rupees, useKala, type Product } from "@/lib/kala-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog & Channel Sync — HunarSetu" },
      {
        name: "description",
        content:
          "Sync artisan listings to ONDC, craft cooperatives and global B2B export buyers, and track live stock and authenticity QR codes.",
      },
      { property: "og:title", content: "Catalog & Channel Sync — HunarSetu" },
      {
        property: "og:description",
        content: "One-tap syndication of handmade listings across marketplaces.",
      },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { products, channels, toggleChannel, t } = useKala();
  const [selected, setSelected] = useState<Product | null>(null);
  const syncedCount = channels.filter((c) => c.synced).length;

  return (
    <AppShell
      title={t("catalog.title")}
      subtitle={`${products.length} ${t("catalog.crafts")} · ${syncedCount} ${t("catalog.channelsLive")}`}
    >
      <section className="craft-card space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <RefreshCw className="size-4 text-primary" /> {t("catalog.sync")}
        </h2>
        <ul className="space-y-2">
          {channels.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => toggleChannel(c.id)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                  c.synced ? "border-leaf bg-leaf/10" : "border-border bg-secondary",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.note}</span>
                </span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    c.synced
                      ? "bg-leaf text-leaf-foreground"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  {c.synced && <CheckCircle2 className="size-3.5" />}
                  {c.synced ? t("catalog.synced") : t("catalog.tapToSync")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Layers className="size-4 text-primary" /> {t("catalog.active")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p)}
              className="craft-card overflow-hidden text-left active:scale-[0.98]"
            >
              <img
                src={p.image}
                alt={p.title}
                loading="lazy"
                width={800}
                height={800}
                className="aspect-square w-full object-cover"
              />
              <div className="space-y-2 p-2.5">
                <StatusBadge status={p.status} />
                <p className="line-clamp-2 text-xs font-semibold">{p.title}</p>
                <p className="text-sm font-semibold text-primary">{rupees(p.price)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {p.stock} {t("catalog.inStock")}
                </p>
                <AuthenticityBadge giTag={p.giTag} />
              </div>
            </button>
          ))}
        </div>
      </section>

      <ProductModal product={selected} onClose={() => setSelected(null)} />
    </AppShell>
  );
}
