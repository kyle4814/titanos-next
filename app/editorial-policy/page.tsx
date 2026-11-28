import type { Metadata } from "next";
import Link from "next/link";
import { withSeo, SITE } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import PageHero from "@/components/PageHero";
import { breadcrumbs } from "@/lib/jsonld";
import { GUIDES } from "@/lib/guides";
import { POSTS } from "@/lib/blog";
import "@/components/home-redesign/home-redesign.css";

export const metadata: Metadata = withSeo("/editorial-policy", {
  title: "Editorial policy | How Titanos writes and checks | Titanos",
  description:
    "How Titanos sources, dates, reviews and corrects its guides and articles, who writes them, where AI is used, and how to report a mistake to get it fixed.",
  alternates: { canonical: `${SITE}/editorial-policy` },
  robots: { index: true, follow: true },
});

const REVIEWED = "2026-11-29";
const ABR_VERIFY = "https://abr.business.gov.au/ABN/View?id=34318502254";
const h2 = { fontSize: "clamp(1.35rem, 2.2vw, 1.8rem)", color: "var(--pe-gold-hi)", margin: "40px 0 14px" } as const;
const p = { margin: "0 0 14px", lineHeight: 1.75, color: "var(--pe-text)" } as const;
const a = { color: "var(--pe-gold-hi)" } as const;
const li = { marginBottom: 8 } as const;

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function EditorialPolicyPage() {
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE}/editorial-policy#page`,
    url: `${SITE}/editorial-policy`,
    name: "Titanos editorial policy",
    inLanguage: "en-AU",
    dateModified: REVIEWED,
    author: { "@type": "Person", name: "Kyle Deligny", url: `${SITE}/authors/kyle-deligny` },
    about: "How Titanos sources, dates, reviews and corrects its published guides and articles",
  };
  return (
    <>
      <JsonLd data={webPage} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Editorial policy", path: "/editorial-policy" }])} />
      <PageHero
        badge="EDITORIAL POLICY"
        title="How we write and check what we publish"
        tagline="Who writes it, where the facts come from, how it is dated, and how a mistake gets fixed"
      />
      <div className="pe-wrap" style={{ maxWidth: 820, padding: "0 0 80px", position: "relative", zIndex: 2, color: "var(--pe-text)" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: 14, color: "var(--pe-mute)", marginBottom: 20 }}>
          <Link href="/" style={a}>Home</Link> / <span aria-current="page">Editorial policy</span>
        </nav>
        <p style={{ ...p, color: "var(--pe-mute)", fontSize: 14 }}>Policy last reviewed {fmt(REVIEWED)}.</p>
        <p style={p}>
          Titanos publishes {GUIDES.length} guides and {POSTS.length} articles on email security, the Privacy Act, the Essential Eight and practical automation for Australian small business. This page says how they are made, so you can judge them before you rely on them.
        </p>

        <h2 style={h2}>Who writes and reviews it</h2>
        <p style={p}>
          Every guide and article is published under the name of <Link href="/authors/kyle-deligny" style={a}>Kyle Deligny</Link>, the founder and only operator of Titanos in Brisbane. He is not a lawyer, and nothing here is legal, tax or financial advice. Pages say so, and they link to the primary source so you can read the rule itself. His business is a registered sole trader, ABN 34 318 502 254, which you can check on the <a href={ABR_VERIFY} rel="noopener noreferrer" style={a}>Australian Business Register</a>.
        </p>

        <h2 style={h2}>Where the facts come from</h2>
        <ul style={{ ...p, paddingLeft: 22 }}>
          <li style={li}>Legal and regulatory claims link to a primary source: legislation.gov.au, the OAIC, the Australian Cyber Security Centre, ACMA, or the standard itself.</li>
          <li style={li}>Every figure carries its method and its date. If a number cannot be traced to a source or a stated calculation, it is left out.</li>
          <li style={li}>Worked examples are labelled as example numbers, not data. A modelled number is never presented as revenue or as a client result.</li>
          <li style={li}>We do not publish testimonials, reviews or case results that did not happen. Titanos is early in its life and the <Link href="/about" style={a}>about page</Link> says plainly where things stand.</li>
        </ul>

        <h2 style={h2}>How pages are dated and reviewed</h2>
        <p style={p}>
          Each guide and article shows a byline, the date it was first published and the date it was last reviewed. A review means the sources were re-read against the live rule and the page was changed if the rule had moved. A review date is only moved when that check has happened, never to make a page look fresh. Law and programs change, so the date matters: if a page is old, check the linked source first.
        </p>

        <h2 style={h2}>Where AI is used</h2>
        <p style={p}>
          Claude Code, Anthropic&apos;s coding tool, helps with drafting and with building the site, under Kyle&apos;s direction. Kyle decides what is published and is accountable for it. If a funder or platform asks whether AI helped write something, the honest answer for these pages is yes. We say so openly because a reader should know.
        </p>

        <h2 style={h2}>Independence and commercial links</h2>
        <p style={p}>
          Titanos sells a free scan, a fixed-price Privacy Act and Essential Eight engagement, monitoring and AI implementation. Guides and articles link to those where they are relevant, and the link goes to the page that states the price. Content is written to answer the question first. We do not use fear, fake urgency or invented scarcity, and we do not pay for placement.
        </p>

        <h2 style={h2}>Privacy of the people we write about</h2>
        <p style={p}>
          Our scans read public records only, and we do not publish findings about a named business that has not asked us to look. Where an example is needed, it is labelled as an example. See <Link href="/methodology" style={a}>the methodology</Link> and <Link href="/trust" style={a}>the trust page</Link>.
        </p>

        <h2 style={h2}>Corrections</h2>
        <p style={p}>
          If something here is wrong, email <a href="mailto:kyle@titanos.tech" style={a}>kyle@titanos.tech</a> with the page and the source you are relying on. A confirmed error is fixed, the last reviewed date is moved to the day of the fix, and a material change is noted on the page. Corrections are made within a few working days of a confirmed report.
        </p>

        <h2 style={h2}>Where to look next</h2>
        <ul style={{ ...p, paddingLeft: 22 }}>
          <li style={li}><Link href="/guides" style={a}>All guides</Link> and <Link href="/blog" style={a}>all articles</Link></li>
          <li style={li}><Link href="/glossary" style={a}>Glossary</Link> of DMARC, SPF, DKIM, Essential Eight and Privacy Act terms</li>
          <li style={li}><Link href="/about" style={a}>About Titanos</Link> and <Link href="/authors/kyle-deligny" style={a}>the author profile</Link></li>
        </ul>
      </div>
    </>
  );
}
