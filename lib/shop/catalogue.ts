// C5 shop: build shelves from what is already on disk (offers, products, courses, generator configs).
import type { Shelf, GeneratorConfig, Availability } from "./types";

type OfferIn = {
  slug: string; name: string; bluf: string; youGet: string[]; priceAud: number | null;
  cadence: "month" | "one-off" | "per-seat-month" | "quote"; status: string;
  faq: { q: string; a: string }[]; group?: string;
};
type ProductIn = {
  slug: string; kind: string; name: string; bluf: string; youGet: string[]; offerSlug?: string;
  faq: { q: string; a: string }[];
};

export function shelfFromOffer(o: OfferIn, links: Record<string, string>): Shelf {
  const url = o.status === "READY" ? links[o.slug] || null : null;
  const quote = o.priceAud === null || o.cadence === "quote";
  let availability: Availability = "SOON";
  if (o.status === "READY") availability = url && !quote && o.priceAud! > 0 ? "BUYABLE" : quote ? "QUOTE" : "FREE_STEP";
  if (o.status === "READY" && quote) availability = "QUOTE";
  return {
    id: `offer:${o.slug}`, kind: "offer", slug: o.slug, name: o.name, bluf: o.bluf, bullets: o.youGet, faq: o.faq,
    priceAud: quote ? null : o.priceAud, cadence: quote ? "quote" : o.cadence,
    priceLabel: quote ? "QUOTE" : "PUBLISHED", status: o.status, availability, buyUrl: url,
    href: `/offers/${o.slug}`, source: "lib/offers/data", synthetic: false, tags: [o.group ?? "offer"],
  };
}

// Products and courses take their price from the linked offer; a suggested price is never shown (it is a Stripe-card proposal).
export function shelfFromProduct(p: ProductIn, offers: OfferIn[], links: Record<string, string>): Shelf {
  const off = p.offerSlug ? offers.find((o) => o.slug === p.offerSlug) : undefined;
  const base = off ? shelfFromOffer(off, links) : null;
  const isCourse = p.kind === "course";
  return {
    id: `${isCourse ? "course" : "product"}:${p.slug}`, kind: isCourse ? "course" : "product", slug: p.slug,
    name: p.name, bluf: p.bluf, bullets: p.youGet, faq: p.faq,
    priceAud: base ? base.priceAud : null, cadence: base ? base.cadence : "none",
    priceLabel: base ? base.priceLabel : "UNKNOWN", status: base ? base.status : "CHECK",
    availability: base ? base.availability : "SOON", buyUrl: base ? base.buyUrl : null,
    href: `/products/${p.slug}`, source: "lib/products/products.ts", synthetic: false, tags: [p.kind],
  };
}

export function shelfFromConfig(c: GeneratorConfig): Shelf {
  const passed = !!c.proof && c.proof.passed;
  return {
    id: `generator:${c.id}`, kind: "generator", slug: c.id, name: c.name, bluf: c.bluf,
    bullets: [`Job: ${c.job}`, `Sector: ${c.sector}`, `Country: ${c.country}`],
    faq: [{ q: "How is the price set?", a: "You get an instant quote from the shelf. The price is fixed before you pay." }],
    priceAud: null, cadence: "quote", priceLabel: "QUOTE", status: passed ? "READY" : "CHECK",
    availability: passed ? "QUOTE" : "SOON", buyUrl: null, href: `/shop#${c.id}`,
    source: "generator config", synthetic: c.synthetic, proof: c.proof, tags: [c.job, c.sector, c.country],
  };
}

export function buildShelves(i: { offers: OfferIn[]; products: ProductIn[]; configs: GeneratorConfig[]; links: Record<string, string>; productLinks?: Record<string, string> }): Shelf[] {
  const out: Shelf[] = [];
  const inProducts = new Set(i.products.map((p) => p.offerSlug).filter(Boolean));
  for (const o of i.offers) if (!inProducts.has(o.slug)) out.push(shelfFromOffer(o, i.links));
  for (const p of i.products) out.push(shelfFromProduct(p, i.offers, i.links));
  for (const c of i.configs) out.push(shelfFromConfig(c));
  const seen = new Set<string>();
  for (const s of out) { if (seen.has(s.id)) throw new Error(`duplicate shelf ${s.id}`); seen.add(s.id); }
  return out;
}
