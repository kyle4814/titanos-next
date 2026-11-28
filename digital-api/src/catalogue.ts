// The catalogue the Worker trusts. The data is generated (catalogue.generated.ts); a client never supplies a price or a file.
import { GENERATED_ITEMS } from "./catalogue.generated.ts";
export interface DigitalItem { slug: string; title: string; priceCents: number; r2Key: string; filename: string; bytes: number; sha256: string }
export const ITEMS: readonly DigitalItem[] = GENERATED_ITEMS;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
export function findItem(slug: unknown, items: readonly DigitalItem[] = ITEMS): DigitalItem | undefined {
  return typeof slug === "string" && SLUG_RE.test(slug) ? items.find((i) => i.slug === slug) : undefined;
}
