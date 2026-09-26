import type { LanguageCode } from "@/lib/languages";

export type AudioManifest = {
  provider: string | null;
  unsupported: string[];
  clips: Record<string, Partial<Record<LanguageCode, { file: string; hash: string }>>>;
};

/** Public URL of a clip's audio file, or null when it was not generated. */
export function resolveClip(
  manifest: AudioManifest,
  clip: string,
  lang: LanguageCode,
): string | null {
  const file = manifest.clips[clip]?.[lang]?.file;
  return file ? `/audio/${file}` : null;
}
