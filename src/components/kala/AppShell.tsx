import { Link, useRouterState } from "@tanstack/react-router";
import { Grid2x2, Mic, Package, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { LANGUAGES, useKala } from "@/lib/kala-store";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Studio", icon: Mic },
  { to: "/catalog", label: "Catalog", icon: Grid2x2 },
  { to: "/orders", label: "Orders", icon: Package },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { language, setLanguage } = useKala();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="canvas-texture min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-lift">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
                <Sparkles className="size-3.5 shrink-0" /> KalaLink
              </p>
              <h1 className="truncate text-xl font-semibold">{title}</h1>
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
              RD
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  language === l.code
                    ? "border-transparent bg-indigo text-indigo-foreground"
                    : "border-border bg-secondary text-secondary-foreground",
                )}
              >
                {l.native}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 space-y-5 px-4 pt-5 pb-28">{children}</main>

        <nav className="fixed bottom-0 z-30 w-full max-w-md border-t border-border bg-background/95 px-2 py-2 backdrop-blur">
          <ul className="grid grid-cols-3">
            {tabs.map((t) => {
              const active = pathname === t.to;
              const Icon = t.icon;
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors",
                      active ? "bg-accent text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
