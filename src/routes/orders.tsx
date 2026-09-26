import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Box, MapPin, PackageCheck, Tag, Truck, Wallet } from "lucide-react";

import { AppShell } from "@/components/kala/AppShell";
import { SpeakButton } from "@/components/kala/shared";
import { rupees, useKala } from "@/lib/kala-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders & Payouts — HunarSetu" },
      {
        name: "description",
        content:
          "Icon-led order cards with a three-step pack, label and handover tracker, spoken instructions and instant UPI payout summaries.",
      },
      { property: "og:title", content: "Orders & Payouts — HunarSetu" },
      {
        property: "og:description",
        content: "Visual dispatch tracking and instant payouts for artisans.",
      },
    ],
  }),
  component: OrdersPage,
});

const steps = [
  { labelKey: "orders.pack", icon: Box },
  { labelKey: "orders.label", icon: Tag },
  { labelKey: "orders.handover", icon: Truck },
] as const;

function OrdersPage() {
  const { orders, products, t } = useKala();
  const pending = orders.filter((o) => o.step < 3).reduce((s, o) => s + o.payout, 0);
  const paid = orders.filter((o) => o.step === 3).reduce((s, o) => s + o.payout, 0);

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
            <p className="mt-1 text-xl font-semibold text-foreground">{rupees(pending)}</p>
          </div>
          <div className="rounded-xl bg-leaf/15 p-3">
            <p className="text-[11px] font-semibold text-foreground">{t("orders.paid")}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{rupees(paid)}</p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Banknote className="size-4 shrink-0 text-leaf" /> {t("orders.lastTransfer")}
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
                  <p className="mt-0.5 text-base font-semibold text-primary">{rupees(o.payout)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {steps.map((s, i) => {
                  const done = o.step > i;
                  const Icon = done ? PackageCheck : s.icon;
                  return (
                    <div
                      key={s.labelKey}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold",
                        done
                          ? "bg-leaf text-leaf-foreground"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" />
                      {t(s.labelKey)}
                    </div>
                  );
                })}
              </div>

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
