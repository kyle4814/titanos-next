// C5: turn the real catalogue products and courses (lib/products/products.ts) into gradable entries.
// Status is NEVER read from the product file: it comes only from lib/shop/product_status.json, and every READY there is re-verified.
import type { Entry, StripeRef } from "./entry_grade.ts";
import { TRUST_REFUND_LINE } from "./policy.ts";

type ProductIn = {
  slug: string; kind: string; name: string; bluf: string; forWho: string[]; youGet: string[];
  delivery: { file: string; format: string }; suggestedPriceAud: number; offerSlug?: string;
  outline?: { title: string; lessons: { title: string; outcome: string }[] }[]; faq: { q: string; a: string }[];
};
export type StatusRow = { status: "CHECK" | "READY"; seal?: string };

export function stripeFromLink(url: string | undefined): StripeRef {
  if (!url) return null;
  if (url.startsWith("mock://")) return { mode: "mock", url };
  return { mode: /^https:\/\/buy\.stripe\.com\/test_/.test(url) ? "test" : "live", url };
}

export function entryFromProduct(p: ProductIn, links: Record<string, string>, statuses: Record<string, StatusRow>): Entry {
  const refund = p.faq.find((f) => f.a.includes(TRUST_REFUND_LINE))?.a ?? "";
  const st = statuses[p.slug];
  return {
    slug: p.slug, kind: p.kind === "course" ? "course" : "product", name: p.name, bluf: p.bluf,
    outcome: p.youGet[0] ?? "", forWho: p.forWho, youGet: p.youGet,
    priceAud: p.suggestedPriceAud, currency: "AUD", priceLabel: "PROPOSED",
    refundLine: refund, stripe: stripeFromLink(links[p.slug]), delivery: p.delivery, outline: p.outline,
    synthetic: false, status: st?.status === "READY" ? "READY" : "CHECK", ...(st?.seal ? { seal: st.seal } : {}),
  };
}
