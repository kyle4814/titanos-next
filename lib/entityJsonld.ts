// Entity and glossary schema builders (new file; lib/jsonld.ts stays as it is).
// Everything here repeats facts already public on titanos.tech: name, role, Brisbane, ABN, the blog.
import { SITE } from "@/lib/seo";
import { ORG_ID, type Json } from "@/lib/jsonld";
import type { GlossaryEntry } from "@/lib/glossary";

const CTX = "https://schema.org";
export const KYLE_ID = `${SITE}/authors/kyle-deligny#person`;
export const KYLE_PATH = "/authors/kyle-deligny";

/** What Kyle works on and writes about. Each item matches a section of the live site or a blog tag. */
export const KYLE_KNOWS_ABOUT = [
  "AI automation for small business",
  "Email authentication (SPF, DKIM, DMARC)",
  "Australian Privacy Act 1988 and the Australian Privacy Principles",
  "Notifiable Data Breaches scheme",
  "ACSC Essential Eight",
  "External attack surface monitoring",
  "Business email compromise",
  "Trade business admin automation",
];

export function kylePerson(): Json {
  return {
    "@type": "Person",
    "@id": KYLE_ID,
    name: "Kyle Deligny",
    url: `${SITE}${KYLE_PATH}`,
    mainEntityOfPage: `${SITE}${KYLE_PATH}`,
    image: `${SITE}/kyle.jpg`,
    jobTitle: "Founder and operator",
    description:
      "Founder and sole operator of TITANOS, a Brisbane AI implementation, Privacy Act compliance and email security practice for Australian small business.",
    worksFor: { "@id": ORG_ID },
    affiliation: { "@id": ORG_ID },
    workLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "Brisbane", addressRegion: "QLD", addressCountry: "AU" } },
    knowsAbout: KYLE_KNOWS_ABOUT,
    email: "mailto:kyle@titanos.tech",
  };
}

/** Organisation node for the same graph: the founder link goes both ways, by @id. */
export function orgFounderLink(): Json {
  return { "@type": "Organization", "@id": ORG_ID, name: "Titanos", url: SITE, founder: { "@id": KYLE_ID } };
}

export function profilePage(p: { dateModified: string; datePublished: string }): Json {
  return {
    "@context": CTX,
    "@type": "ProfilePage",
    "@id": `${SITE}${KYLE_PATH}#profile`,
    url: `${SITE}${KYLE_PATH}`,
    name: "Kyle Deligny, founder of Titanos",
    inLanguage: "en-AU",
    dateCreated: p.datePublished,
    dateModified: p.dateModified,
    mainEntity: { "@id": KYLE_ID },
  };
}

export function personGraph(): Json {
  return { "@context": CTX, "@graph": [kylePerson(), orgFounderLink()] };
}

export function definedTermSet(entries: GlossaryEntry[], dateModified: string): Json {
  const setId = `${SITE}/glossary#set`;
  return {
    "@context": CTX,
    "@type": "DefinedTermSet",
    "@id": setId,
    name: "Titanos glossary of email security, Essential Eight and Privacy Act terms",
    url: `${SITE}/glossary`,
    inLanguage: "en-AU",
    dateModified,
    author: { "@id": KYLE_ID },
    publisher: { "@id": ORG_ID },
    hasDefinedTerm: entries.map((e) => ({
      "@type": "DefinedTerm",
      "@id": `${SITE}/glossary#${e.id}`,
      name: e.term,
      termCode: e.id,
      description: e.definition,
      url: `${SITE}/glossary#${e.id}`,
      inDefinedTermSet: setId,
    })),
  };
}
