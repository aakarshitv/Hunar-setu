import { LANGUAGES, useKala } from "@/lib/kala-store";
import { cn } from "@/lib/utils";

export function LanguagePills({ className }: { className?: string }) {
  const { language, setLanguage } = useKala();
  return (
    <div className={cn("flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none]", className)}>
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
  );
}
