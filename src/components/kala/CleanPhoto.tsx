import { CLEAN, type BgStyle } from "@/lib/clean-assets";
import { cn } from "@/lib/utils";

/**
 * Background and product are separate layers: enhancement filters touch only the
 * background, so the product is always shown exactly as photographed.
 */
export function CleanPhoto({ bgStyle, enhanced }: { bgStyle: BgStyle; enhanced: boolean }) {
  return (
    <div className="relative size-full">
      <img
        src={CLEAN.backgrounds[bgStyle]}
        alt=""
        draggable={false}
        className={cn(
          "absolute inset-0 size-full object-cover transition-[filter] duration-500",
          enhanced && "brightness-105 contrast-110 saturate-125",
        )}
      />
      <img
        src={CLEAN.cutout}
        alt="The pot on a clean background"
        draggable={false}
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );
}
