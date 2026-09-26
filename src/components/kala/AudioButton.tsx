import { Volume2 } from "lucide-react";

import type { ClipId } from "@/content/narration";
import { useKala } from "@/lib/kala-store";
import { queueKey, useNarrator } from "@/lib/narrator";
import { cn } from "@/lib/utils";

export function AudioButton({
  clips,
  label,
  iconOnly = false,
  className,
}: {
  clips: ClipId[];
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const { t } = useKala();
  const { play, stop, playingKey } = useNarrator();
  const playing = playingKey === queueKey(clips);
  const text = playing ? t("common.stop") : (label ?? t("common.listen"));

  return (
    <button
      type="button"
      onClick={() => (playing ? stop() : play(clips))}
      aria-pressed={playing}
      aria-label={text}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-indigo text-xs font-semibold text-indigo-foreground active:scale-95",
        iconOnly ? "size-9" : "px-3 py-2",
        className,
      )}
    >
      {playing ? <SoundBars /> : <Volume2 className="size-4" />}
      {!iconOnly && text}
    </button>
  );
}

function SoundBars() {
  return (
    <span aria-hidden className="flex h-4 items-center gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="wave-bar h-4 w-0.5 rounded-full bg-current"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}
