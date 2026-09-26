import { createFileRoute } from "@tanstack/react-router";
import {
  Banknote,
  Box,
  CheckCircle2,
  MapPin,
  PackageCheck,
  Tag,
  Truck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/kala/AppShell";
import { SpeakButton } from "@/components/kala/shared";
import { useCountUp } from "@/hooks/use-count-up";
import { interpolate, type TranslationKey } from "@/lib/i18n";
import { ARTISAN, rupees, useKala } from "@/lib/kala-store";
import { payoutTotals, type Order } from "@/lib/orders";
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

const nextActionKey: Record<0 | 1 | 2, TranslationKey> = {
  0: "orders.markPacked",
  1: "orders.markLabelled",
  2: "orders.handOver",
};

// Long enough for the tracker animation; stops a double tap from skipping a step.
const BUSY_MS = 700;

function OrdersPage() {
  const { orders, products, advanceOrder, lastTransfer, t } = useKala();
  const { pending, paid } = payoutTotals(orders);
  const pendingShown = useCountUp(pending);
  const paidShown = useCountUp(paid);
  const [busy, setBusy] = useState(false);

  const onAdvance = (o: Order) => {
    if (busy || o.step === 3) return;
    setBusy(true);
    window.setTimeout(() => setBusy(false), BUSY_MS);
    advanceOrder(o.id);
    if (o.step === 2) {
      toast.success(
        interpolate(t("orders.sentToast"), { amount: rupees(o.payout), upi: ARTISAN.upi }),
      );
    }
  };

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
            <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
              {rupees(pendingShown)}
            </p>
          </div>
          <div className="rounded-xl bg-leaf/15 p-3">
            <p className="text-[11px] font-semibold text-foreground">{t("orders.paid")}</p>
            <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
              {rupees(paidShown)}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Banknote className="size-4 shrink-0 text-leaf" />
          {interpolate(t("orders.lastTransfer"), {
            amount: rupees(lastTransfer),
            upi: ARTISAN.upi,
          })}
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

              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-leaf transition-[width] duration-500 ease-out"
                  style={{ width: `${(o.step / 3) * 100}%` }}
                />
              </div>

              <div className="flex items-center gap-2">
                {steps.map((s, i) => {
                  const done = o.step > i;
                  const Icon = done ? PackageCheck : s.icon;
                  return (
                    <div
                      key={s.labelKey}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors duration-500",
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

              {o.step === 3 ? (
                <p className="flex items-center justify-center gap-2 rounded-xl bg-leaf/15 py-3 text-sm font-semibold">
                  <CheckCircle2 className="size-4 text-leaf" /> {t("orders.done")}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => onAdvance(o)}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-70"
                >
                  {t(nextActionKey[o.step])}
                </button>
              )}

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
