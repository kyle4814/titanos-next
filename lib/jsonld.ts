// Schema.org builders. One place, so every page emits the same Organization identity
// and no claim appears in structured data that is not on the visible page.
import { SITE, ogUrl } from "@/lib/seo";

const CTX = "https://schema.org";
export const ORG_ID = `${SITE}/#organization`;
export const SITE_ID = `${SITE}/#website`;

export type Json = Record<string, unknown>;

/**
 * One entity, typed Organization and ProfessionalService, so search engines read Titanos as an Australian
 * service business and not the Titan OS television platform. No street address is published (Brisbane
 * locality only). sameAs lists only profiles that exist and are public; add each new profile (Google
 * Business Profile, LinkedIn, Crunchbase) here once it is live.
 */
export const ORG_SAME_AS = ["https://github.com/kyle4814"];

export function organization(): Json {
  return {
    "@context": CTX,
    "@type": ["Organization", "ProfessionalService"],
    "@id": ORG_ID,
    name: "Titanos",
    alternateName: ["TITANOS", "Titanos AI automation Brisbane"],
    url: SITE,
    logo: `${SITE}/apple-touch-icon.png`,
    image: `${SITE}/og-image.png`,
    description:
      "Solo AI implementation, Privacy Act compliance and external security monitoring practice for Australian small business, based in Brisbane.",
    slogan: "AI automation and Privacy Act compliance for Australian small business",
    founder: { "@type": "Person", name: "Kyle Deligny", url: `${SITE}/about` },
    areaServed: { "@type": "Country", name: "Australia" },
    serviceType: ["AI automation", "Privacy Act compliance", "External security monitoring", "Essential Eight assessment"],
    knowsAbout: ["AI automation for small business", "Privacy Act 1988", "Essential Eight", "DMARC and email security"],
    address: { "@type": "PostalAddress", addressLocality: "Brisbane", addressRegion: "QLD", addressCountry: "AU" },
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "kyle@titanos.tech", areaServed: "AU", availableLanguage: "en-AU" },
    sameAs: ORG_SAME_AS,
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
    author: { "@type": "Person", name: "Kyle Deligny", url: `${SITE}/about` },
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

export function dataset(d: { name: string; description: string; path: string; files: { url: string; format: string }[]; dateModified: string; licenceNote: string }): Json {
  return {
    "@context": CTX,
    "@type": "Dataset",
    name: d.name,
    description: d.description,
    url: `${SITE}${d.path}`,
    dateModified: d.dateModified,
    creator: { "@id": ORG_ID },
    isAccessibleForFree: true,
    license: d.licenceNote,
    distribution: d.files.map((f) => ({ "@type": "DataDownload", encodingFormat: f.format, contentUrl: `${SITE}${f.url}` })),
  };
}
