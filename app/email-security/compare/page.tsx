import type { Metadata } from "next";
import Link from "next/link";
import { withSeo } from "@/lib/seo";
import {
  COMPARE, COMPARE_PATH, COMPARE_PUBLISHED, COMPARE_REVIEWED, COMPARE_REVIEWED_LONG,
  DIY_VS_MANAGED, FAQ, FREE_OPTIONS, SOURCES, TOOLS,
} from "@/lib/dmarcCompare";
import "@/components/home-redesign/home-redesign.css";
import { Crumbs, Cta, FaqList, Schema, crumbLd, faqPage, s } from "../setup/_parts";
import { article } from "@/lib/jsonld";

export const metadata: Metadata = withSeo(COMPARE_PATH, {
  title: COMPARE.title,
  description: COMPARE.description,
  alternates: { canonical: `https://titanos.tech${COMPARE_PATH}` },
  openGraph: { title: COMPARE.title, description: COMPARE.description, type: "article" },
  robots: { index: true, follow: true },
});

export default function ComparePage() {
  const base = article({ path: COMPARE_PATH, headline: COMPARE.h1, description: COMPARE.description, datePublished: COMPARE_PUBLISHED, dateModified: COMPARE_REVIEWED });
  const ld = { ...base, author: { "@type": "Person", name: "Kyle Deligny", url: "https://titanos.tech/about" }, inLanguage: "en-AU" };
  return (
    <>
      <Schema items={[ld, faqPage(FAQ), crumbLd([{ name: "Home", path: "/" }, { name: "DMARC tools compared", path: COMPARE_PATH }])]} />
      <main className={s.shell}>
        <div className={s.wrap}>
          <Crumbs trail={[{ name: "Home", path: "/" }, { name: "DMARC tools compared" }]} />
          <p className={s.kicker}>Email security</p>
          <h1 className={s.h1}>{COMPARE.h1}</h1>
          <p className={s.byline}>
            By <Link href="/about">Kyle Deligny</Link>, Brisbane. Last reviewed <time dateTime={COMPARE_REVIEWED}>{COMPARE_REVIEWED_LONG}</time>. General information, not legal advice. Prices change, so confirm on each vendor page.
          </p>
          <p className={s.bluf}>
            Publishing a DMARC record is free. A tool is only needed to read the reports, and several tools have a free tier. For one or two small domains you can start free and do it yourself. The vendors that publish prices list paid plans from roughly US$20 to US$36 a month for the entry tiers we read (PowerDMARC&apos;s volume-based Basic plan may start lower), and Valimail does not publish its paid prices. We sell our own setup guide and audit call, so we say so up front.
          </p>

          <section className={s.sec} aria-labelledby="what">
            <h2 id="what">What a DMARC tool actually does</h2>
            <p className={s.p}>A DMARC record asks receiving mail systems to send you daily summary reports about mail that claims to be from your domain. The reports are XML files. A DMARC tool collects them, shows which servers sent mail as you, and flags the ones failing SPF and DKIM. That is how you find your own invoicing or booking system before you tighten the policy. The record and the policy stages are the same whichever tool you pick, and our <Link href="/email-security/setup">SPF, DKIM and DMARC setup guides</Link> cover them.</p>
          </section>

          <section className={s.sec} aria-labelledby="table">
            <h2 id="table">Public pricing, read on {COMPARE_REVIEWED_LONG}</h2>
            <div className={s.tablewrap}>
              <table className={s.table}>
                <thead><tr><th>Tool</th><th>Public pricing</th><th>Free tier</th><th>How we read it</th></tr></thead>
                <tbody>
                  {TOOLS.map((t) => (
                    <tr key={t.slug}><td><a href={t.source.url} rel="noopener noreferrer" target="_blank">{t.name}</a></td><td>{t.pricing}</td><td>{t.freeTier}</td><td>{t.priceChecked}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={s.note}>Prices are in the currency each vendor shows, mostly US dollars, before any GST. They are what the public pages showed on the date above, not quotes. Plans differ in domain limits, email volume and history, so a lower price is not automatically better value.</p>
          </section>

          <section className={s.sec} aria-labelledby="fit">
            <h2 id="fit">Where each one fits</h2>
            <ul className={s.gotchas}>
              {TOOLS.map((t) => (
                <li key={t.slug}><strong>{t.name}</strong><span>Good for: {t.goodFor} Watch for: {t.watchFor}</span></li>
              ))}
            </ul>
          </section>

          <section className={s.sec} aria-labelledby="free">
            <h2 id="free">Free options</h2>
            <ul className={s.gotchas}>
              {FREE_OPTIONS.map((f) => (
                <li key={f.name}><strong>{f.name}</strong><span>{f.what} {f.price} <a href={f.source.url} rel="noopener noreferrer" target="_blank">Source</a>.</span></li>
              ))}
            </ul>
          </section>

          <section className={s.sec} aria-labelledby="diy">
            <h2 id="diy">Do it yourself or have it managed</h2>
            <p className={s.p}>The tool question is separate from the people question. A tool shows you the reports. Someone still has to read them and make the changes. Here is how the two paths compare.</p>
            <div className={s.tablewrap}>
              <table className={s.table}>
                <thead><tr><th>Question</th><th>Do it yourself</th><th>Managed</th></tr></thead>
                <tbody>
                  {DIY_VS_MANAGED.map((r) => (
                    <tr key={r.question}><td>{r.question}</td><td>{r.diy}</td><td>{r.managed}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={s.p}>Start with a free <Link href="/tools/email-spoofing-check">email spoofing check</Link> to see where your domain stands today. It reads public DNS only.</p>
          </section>

          <FaqList items={FAQ} />

          <section className={s.sec} aria-labelledby="sources">
            <h2 id="sources">Sources</h2>
            <ul className={s.sources}>
              {SOURCES.map((x) => (<li key={x.url}><a href={x.url} rel="noopener noreferrer" target="_blank">{x.label}</a></li>))}
            </ul>
          </section>
          <Cta />
        </div>
      </main>
    </>
  );
}
