// Schema.org builders. One place, so every page emits the same Organization identity
// and no claim appears in structured data that is not on the visible page.
import { SITE, ogUrl } from "@/lib/seo";

const CTX = "https://schema.org";
export const ORG_ID = `${SITE}/#organization`;
export const SITE_ID = `${SITE}/#website`;

export type Json = Record<string, unknown>;

export function organization(): Json {
  return {
    "@context": CTX,
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Titanos",
    url: SITE,
    logo: `${SITE}/apple-touch-icon.png`,
    description:
      "Solo AI implementation, Privacy Act compliance and external security monitoring practice for Australian small business.",
    founder: { "@type": "Person", name: "Kyle Deligny" },
    areaServed: ["AU", "NZ", "SG"],
    address: { "@type": "PostalAddress", addressLocality: "Brisbane", addressRegion: "QLD", addressCountry: "AU" },
    identifier: { "@type": "PropertyValue", name: "ABN", value: "34318502254" },
  };
}

export function website(): Json {
  return {
    "@context": CTX,
    "@type": "WebSite",
    "@id": SITE_ID,
    url: SITE,
    name: "TITANOS",
    inLanguage: "en-AU",
    publisher: { "@id": ORG_ID },
  };
}

export function faqPage(items: { q: string; a: string }[]): Json | null {
  if (!items.length) return null;
  return {
    "@context": CTX,
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}

export function article(a: {
  path: string;
  headline: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
}): Json {
  const url = `${SITE}${a.path}`;
  return {
    "@context": CTX,
    "@type": "Article",
    headline: a.headline,
    description: a.description,
    url,
    image: `${SITE}${ogUrl(a.path)}`,
    ...(a.datePublished ? { datePublished: a.datePublished, dateModified: a.dateModified ?? a.datePublished } : {}),
    author: { "@type": "Person", name: "Kyle Deligny" },
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

/** Only a purchasable (READY, priced) offer gets an Offer block; the rest are described, not sold. */
export function product(p: {
  path: string;
  name: string;
  description: string;
  priceAud: number | null;
  buyable: boolean;
}): Json {
  const url = `${SITE}${p.path}`;
  return {
    "@context": CTX,
    "@type": "Product",
    name: p.name,
    description: p.description,
    url,
    image: `${SITE}${ogUrl(p.path)}`,
    brand: { "@id": ORG_ID },
    ...(p.buyable && p.priceAud != null
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: p.priceAud,
            priceCurrency: "AUD",
            availability: "https://schema.org/InStock",
            seller: { "@id": ORG_ID },
          },
        }
      : {}),
  };
}

export function breadcrumbs(trail: { name: string; path: string }[]): Json {
  return {
    "@context": CTX,
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: `${SITE}${t.path}` })),
  };
}

export function serialise(data: Json): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
