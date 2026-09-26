import type { LanguageCode } from "../../src/lib/languages.ts";

export type Provider = "sarvam" | "mac";
export type Entry = { file: string; hash: string };
export type Manifest = {
  provider: Provider | null;
  unsupported: LanguageCode[];
  clips: Record<string, Partial<Record<LanguageCode, Entry>>>;
};

const filesOf = (m: Manifest) =>
  Object.values(m.clips).flatMap((byLang) => Object.values(byLang).map((e) => e.file));

/** Files `previous` referenced that `next` does not — safe to delete once `next` is saved. */
export function staleFiles(previous: Manifest, next: Manifest): string[] {
  const keep = new Set(filesOf(next));
  return filesOf(previous).filter((file) => !keep.has(file));
}
