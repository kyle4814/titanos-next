import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { withSeo, SITE } from "@/lib/seo";
import { breadcrumbs } from "@/lib/jsonld";
import { TRADE_PROBLEMS, pagePath } from "@/lib/tradeProblems";
import "@/components/home-redesign/home-redesign.css";
import "./automation.css";

const PATH = "/automation";
const TITLE = "Automation Guides for Australian Trades | TITANOS";
const DESC = "Practical guides for Australian tradies on missed calls, quote follow-up, invoice chasing and review requests, with exact message wording and worked examples.";

export const metadata: Metadata = withSeo(PATH, {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}${PATH}` },
  openGraph: { title: TITLE, description: DESC, type: "website", url: `${SITE}${PATH}` },
  robots: { index: true, follow: true },
});

export default function Page() {
  return (
    <main className="tp">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Automation guides for trades", path: PATH }])} />
      <div className="tp-wrap">
        <nav className="tp-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span aria-current="page">Automation guides for trades</span></nav>
        <header>
          <p className="tp-eyebrow">Guides for Australian trades</p>
          <h1>Automation guides for Australian trades</h1>
          <p className="tp-lede">Each guide takes one trade and one problem, such as a plumber missing calls or a builder with silent quotes, and gives you the exact message wording, a worked example with the arithmetic shown, the Spam Act 2003 notes and the matching ready-made kit. The numbers in the examples are labelled examples. Nothing here is a promise of results.</p>
          <p className="tp-by">By <Link href="/about">Kyle Deligny</Link>, Titanos, Brisbane. Last reviewed 28 November 2026.</p>
        </header>
        <div className="tp-hub">
          {TRADE_PROBLEMS.map((p) => (
            <Link key={pagePath(p)} href={pagePath(p)}>
              <span>{p.tradeLabel} / {p.problemLabel}</span>
              <h2>{p.h1.split(":")[0]}</h2>
              <p>{p.description}</p>
            </Link>
          ))}
        </div>
        <section className="tp-sec">
          <h2>How these guides are written</h2>
          <p>Every guide is written for one trade and checked against primary sources, including the ACMA and the Spam Act 2003, the OAIC and the ATO. Message wording marked as from a kit is word for word from the kit. Wording marked as written for the page is suggested and untested. We add new guides a few at a time, and only when each has material of its own to offer.</p>
          <p>Looking for a free calculation first? Try the <Link href="/tools/missed-call-calculator">missed call calculator</Link>, or see what we do for trades on the <Link href="/tradies">trades page</Link>.</p>
        </section>
      </div>
    </main>
  );
}
