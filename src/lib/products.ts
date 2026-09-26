import { productCopy, type ProductCopy } from "@/content/narration";
import type { LanguageCode } from "@/lib/languages";

export function upsertProduct<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((p) => p.id === item.id)
    ? list.map((p) => (p.id === item.id ? item : p))
    : [item, ...list];
}

const copyById: Record<string, Record<LanguageCode, ProductCopy>> = productCopy;

/** Title and story in the chosen language; falls back to the product's own text. */
export function localize(
  product: { id: string; title: string; story: string },
  lang: LanguageCode,
): ProductCopy {
  return copyById[product.id]?.[lang] ?? { title: product.title, story: product.story };
}
