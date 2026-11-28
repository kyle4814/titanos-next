// Pillar guides: the data model and registry for /guides and /guides/[slug].
// Content lives in lib/guides-content/<slug>.ts (one file per guide). Pure data, no React, so scripts can import it.
import { tradieAutomation } from "@/lib/guides-content/tradie-automation-australia";
import { aiReceptionist } from "@/lib/guides-content/ai-receptionist-australia-trades";
import { privacyAct } from "@/lib/guides-content/privacy-act-small-business-australia";
import { essentialEight } from "@/lib/guides-content/essential-eight-small-business";
import { emailSecurity } from "@/lib/guides-content/email-security-small-business-australia";
import { tenders } from "@/lib/guides-content/government-tenders-small-business-australia";
import { stopEmailSpoofing } from "@/lib/guides-content/stop-email-spoofing-my-domain";
import { dmarcMicrosoft365 } from "@/lib/guides-content/dmarc-for-microsoft-365";
import { whatIsDkim } from "@/lib/guides-content/what-is-a-dkim-record";
import { bimiSmallBusiness } from "@/lib/guides-content/bimi-for-small-business";
import { invoiceFraudEmail } from "@/lib/guides-content/invoice-fraud-email-scams-australia";
import { spfRecord } from "@/lib/guides-content/what-is-an-spf-record";
import { servicem8Automation } from "@/lib/guides-content/servicem8-automation-tradies";
import { tradifyVsServicem8 } from "@/lib/guides-content/tradify-vs-servicem8-automation";
import { googleReviewsTradies } from "@/lib/guides-content/google-reviews-tradies-australia";
import { appointmentReminders } from "@/lib/guides-content/automated-appointment-reminders-australia";
import { quoteTemplates } from "@/lib/guides-content/job-quote-template-tradies-australia";
import { GUIDE_EXTRA, POST_RELATED, TOOLS, PRODUCT_LINKS, type RelLink } from "@/lib/seo-links";

/** Inline markup inside any string: [text](href) for links, **bold** for emphasis. Nothing else. */
export type Block =
  | { t: "p"; x: string }
  | { t: "h3"; x: string }
  | { t: "ul"; x: string[] }
  | { t: "ol"; x: string[] }
  | { t: "note"; title: string; x: string }
  | { t: "example"; title: string; x: string[] }
  | { t: "table"; caption: string; head: string[]; rows: string[][] };

export type GuideLink = { label: string; href: string; blurb: string };
export type GuideSource = { label: string; url: string; note?: string };

export type Guide = {
  slug: string;
  /** <title> without suffix; 60 characters or fewer including the " | Titanos" suffix added by the page. */
  seoTitle: string;
  h1: string;
  /** Meta description, 140 to 160 characters. */
  description: string;
  /** Short label on the hub card. */
  cluster: string;
  /** Terms this guide is written to answer (shown in the build receipt and the test, never keyword-stuffed on the page). */
  targetTerms: string[];
  date: string;
  updated: string;
  /** Answer-first summary (40 to 70 words): shown above the intro, repeated in llms-full.txt for answer engines. */
  answer: string;
  intro: Block[];
  sections: { id: string; h2: string; blocks: Block[] }[];
  faq: { q: string; a: string }[];
  sources: GuideSource[];
  related: { posts: string[]; tools: GuideLink[]; products: GuideLink[] };
  nextStep: { label: string; href: string; text: string };
};

const merge = (base: GuideLink[], extra: RelLink[]): GuideLink[] => [...extra.filter((e) => !base.some((b) => b.href === e.href)), ...base];
/** Adds the interactive tools and shop products to each guide's related lists (see lib/seo-links.ts). */
const withTools = (g: Guide): Guide => {
  const x = GUIDE_EXTRA[g.slug] ?? { tools: [], products: [] };
  const tools = x.tools.map((h) => TOOLS.find((t) => t.href === h)!);
  const products = x.products.map((s) => PRODUCT_LINKS[s]);
  const posts = [...g.related.posts, ...Object.entries(POST_RELATED).filter(([slug, r]) => r.guide === g.slug && !g.related.posts.includes(slug)).map(([slug]) => slug)];
  return { ...g, related: { ...g.related, posts, tools: merge(g.related.tools, tools), products: merge(g.related.products, products) } };
};

export const GUIDES: Guide[] = [tradieAutomation, aiReceptionist, privacyAct, essentialEight, emailSecurity, tenders, stopEmailSpoofing, dmarcMicrosoft365, whatIsDkim, bimiSmallBusiness, invoiceFraudEmail, spfRecord].map(withTools);

// SEO20 batch 3 (tradie and service business guides), added on its own lines to keep merges clean.
GUIDES.push(...[servicem8Automation, tradifyVsServicem8, googleReviewsTradies, appointmentReminders, quoteTemplates].map(withTools));

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

const strip = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "");
function blockText(b: Block): string[] {
  switch (b.t) {
    case "p": case "h3": return [b.x];
    case "ul": case "ol": return b.x;
    case "note": return [b.title, b.x];
    case "example": return [b.title, ...b.x];
    case "table": return [b.caption, ...b.head, ...b.rows.flat()];
  }
}
/** Every visible string of a guide (body, FAQ, link blurbs), markup stripped. */
export function guideTexts(g: Guide): string[] {
  const out: string[] = [g.h1, g.description, g.answer];
  for (const b of g.intro) out.push(...blockText(b));
  for (const s of g.sections) { out.push(s.h2); for (const b of s.blocks) out.push(...blockText(b)); }
  for (const f of g.faq) out.push(f.q, f.a);
  out.push(g.nextStep.text);
  for (const l of [...g.related.tools, ...g.related.products]) out.push(l.label, l.blurb);
  return out.map(strip);
}
/** Reading words: intro, sections and FAQ (the prose a reader reads), not sources or link blurbs. */
export function guideWordCount(g: Guide): number {
  const parts: string[] = [];
  for (const b of g.intro) parts.push(...blockText(b));
  for (const s of g.sections) { parts.push(s.h2); for (const b of s.blocks) parts.push(...blockText(b)); }
  for (const f of g.faq) parts.push(f.q, f.a);
  return strip(parts.join(" ")).split(/\s+/).filter(Boolean).length;
}
export function guideHrefs(g: Guide): string[] {
  const hrefs: string[] = [];
  const grab = (s: string) => { for (const m of s.matchAll(/\]\(([^)]+)\)/g)) hrefs.push(m[1]); };
  for (const b of g.intro) blockText(b).forEach(grab);
  for (const s of g.sections) for (const b of s.blocks) blockText(b).forEach(grab);
  for (const f of g.faq) grab(f.a);
  for (const l of [...g.related.tools, ...g.related.products]) hrefs.push(l.href);
  hrefs.push(g.nextStep.href);
  return hrefs;
}
