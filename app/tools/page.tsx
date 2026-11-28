import type { Metadata } from "next";
import Link from "next/link";
import { withSeo, SITE } from "@/lib/seo";
import { breadcrumbs, organization } from "@/lib/jsonld";
import JsonLd from "@/components/JsonLd";
import { TOOLS, GUIDE_LINKS } from "@/lib/seo-links";
import "@/components/home-redesign/home-redesign.css";
import "./tools-hub.css";

const PATH = "/tools";
const TITLE = "Free Tools for Australian Small Business | TITANOS";
const DESC = "Four free tools for Australian small business: a Privacy Act checker, an email spoofing check, an Essential Eight self assessment and a missed call calculator.";

export const metadata: Metadata = withSeo(PATH, {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}${PATH}` },
  openGraph: { title: TITLE, description: DESC, type: "website", url: `${SITE}${PATH}` },
  robots: { index: true, follow: true },
});

const META: Record<string, { h: string; q: string; how: string; guide: string }> = {
  "/tools/privacy-act-checker": {
    h: "Privacy Act small business checker",
    q: "Does the Privacy Act apply to my business?",
    how: "About 3 minutes, a handful of yes or no questions. It explains the turnover test and the exceptions that can apply even to a small business.",
    guide: "privacy-act-small-business-australia",
  },
  "/tools/email-spoofing-check": {
    h: "Email spoofing check (DMARC, SPF and DKIM)",
    q: "Can someone send email pretending to be my business?",
    how: "Type your domain. The tool reads public DNS records only and tells you what is missing. Nothing is probed or changed.",
    guide: "email-security-small-business-australia",
  },
  "/tools/essential-eight-score": {
    h: "Essential Eight self assessment",
    q: "Where does my business sit against the Essential Eight?",
    how: "38 plain-English questions at Maturity Level One, scored in your browser, with a gap list you can hand to your IT provider.",
    guide: "essential-eight-small-business",
  },
  "/tools/missed-call-calculator": {
    h: "Missed call calculator for tradies",
    q: "How much do missed calls cost a trade business?",
    how: "Four numbers from your own business give a monthly and yearly figure. Every assumption is on screen and editable.",
    guide: "tradie-automation-australia",
  },
};

export default function ToolsHub() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Free tools for Australian small business",
    url: `${SITE}${PATH}`,
    inLanguage: "en-AU",
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}${t.href}`, name: META[t.href].h })),
    },
  };
  return (
    <div className="th-page" lang="en-AU">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Free tools", path: PATH }])} />
      <JsonLd data={itemList} />
      <JsonLd data={organization()} />
      <main className="th-wrap">
        <nav className="th-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span aria-current="page">Free tools</span></nav>
        <header className="th-hero">
          <p className="th-kicker">Free tools</p>
          <h1>Free tools for Australian small business</h1>
          <p className="th-lede">Four tools that answer a question owners actually ask: does the Privacy Act cover me, can someone fake my email, where do I stand on the Essential Eight, and what do missed calls cost. Each runs in your browser, needs no account and cites the primary source for every rule it applies.</p>
          <p className="th-by">Built by Kyle Deligny, Brisbane (ABN 34 318 502 254). General information, not legal or security advice. See <Link href="/methodology">how figures are sourced</Link>.</p>
        </header>

        <ul className="th-grid">
          {TOOLS.map((t) => {
            const m = META[t.href];
            const g = GUIDE_LINKS[m.guide];
            return (
              <li key={t.href} className="th-card">
                <p className="th-q">{m.q}</p>
                <h2><Link href={t.href}>{m.h}</Link></h2>
                <p>{t.blurb}</p>
                <p className="th-how">{m.how}</p>
                <div className="th-actions">
                  <Link href={t.href} className="th-btn">Open the tool</Link>
                  <Link href={g.href} className="th-link">Read the guide: {g.label}</Link>
                </div>
              </li>
            );
          })}
        </ul>

        <section className="th-more" aria-labelledby="th-more-h">
          <h2 id="th-more-h">Want more than a score?</h2>
          <p>A tool tells you where you stand. The next step is the paperwork or the fix. Our <Link href="/guides">guides</Link> explain each topic in depth with sources, the <Link href="/blog">blog</Link> covers the questions people search for, and the <Link href="/shop">shop</Link> has checklists and templates priced in AUD with no GST. If you would rather have it done with you, see <Link href="/compliance">Privacy Act and Essential Eight compliance</Link>.</p>
        </section>
      </main>
    </div>
  );
}
