import { CLEAN } from "@/lib/clean-assets";

export function ScanOverlay({ label }: { label: string }) {
  const mask = `url(${CLEAN.mask})`;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" role="status">
      <div
        className="mask-glow absolute inset-0 bg-primary"
        style={{
          maskImage: mask,
          WebkitMaskImage: mask,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
        }}
      />
      <div className="scan-sweep absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-transparent via-background/70 to-transparent" />
      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/80 px-3 py-1.5 text-xs font-semibold text-background">
        {label}
      </span>
    </div>
  );
}
