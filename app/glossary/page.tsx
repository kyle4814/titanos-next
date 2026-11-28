import type { Metadata } from "next";
import Link from "next/link";
import { withSeo } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import PageHero from "@/components/PageHero";
import { breadcrumbs } from "@/lib/jsonld";
import { definedTermSet, KYLE_PATH } from "@/lib/entityJsonld";
import { GLOSSARY, GROUP_LABELS, GLOSSARY_REVIEWED, type GlossaryGroup } from "@/lib/glossary";
import "@/components/home-redesign/home-redesign.css";

const baseMetadata: Metadata = {
  title: "Glossary of email security and privacy terms | Titanos",
  description:
    "Plain-English definitions of DMARC, SPF, DKIM, BIMI, the Essential Eight, the Australian Privacy Principles, NDB and ADM, each with a primary source.",
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/glossary", baseMetadata);

const GROUP_ORDER: GlossaryGroup[] = ["email", "essential8", "privacy", "ai"];

const REVIEWED_LONG = new Date(GLOSSARY_REVIEWED + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

export default function GlossaryPage() {
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
  return (
    <>
      <JsonLd data={definedTermSet(GLOSSARY, GLOSSARY_REVIEWED)} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Glossary", path: "/glossary" }])} />
      <PageHero
        badge="GLOSSARY"
        title="Email security and privacy terms, defined"
        sub="Short, sourced definitions of the terms Australian small businesses meet when they deal with email security, the Essential Eight and the Privacy Act."
      />
      <div className="pe-wrap" style={{ maxWidth: 860, padding: "0 0 80px", position: "relative", zIndex: 2, color: "var(--pe-text)" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: 14, color: "var(--pe-mute)", marginBottom: 20 }}>
          <Link href="/" style={{ color: "var(--pe-gold-hi)" }}>Home</Link> / <span aria-current="page">Glossary</span>
        </nav>
        <p style={{ color: "var(--pe-mute)", fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
          Written by <Link href={KYLE_PATH} style={{ color: "var(--pe-gold-hi)" }}>Kyle Deligny</Link>, founder of Titanos (
          <Link href="/about" style={{ color: "var(--pe-gold-hi)" }}>about</Link>). Last reviewed {REVIEWED_LONG}. This is general information, not legal advice. Every entry links to the standard, statute or regulator it rests on, so you can check it.
        </p>

        <section aria-label="Jump to a term" className="pe-card" style={{ padding: 22, margin: "28px 0 40px" }}>
          <p className="pe-kicker">Jump to a term</p>
          <ul style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", listStyle: "none", margin: 0, padding: 0 }}>
            {sorted.map((e) => (
              <li key={e.id}>
                <a href={`#${e.id}`} style={{ color: "var(--pe-gold-hi)", fontSize: 15 }}>{e.term}</a>
              </li>
            ))}
          </ul>
        </section>

        {GROUP_ORDER.map((g) => (
          <section key={g} aria-labelledby={`grp-${g}`} style={{ marginBottom: 48 }}>
            <h2 id={`grp-${g}`} style={{ fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)", color: "var(--pe-gold-hi)", margin: "0 0 6px" }}>{GROUP_LABELS[g].title}</h2>
            <p style={{ color: "var(--pe-mute)", margin: "0 0 20px" }}>{GROUP_LABELS[g].blurb}</p>
            {GLOSSARY.filter((e) => e.group === g).map((e) => (
              <article key={e.id} id={e.id} className="pe-card" style={{ padding: "22px 24px", marginBottom: 16, scrollMarginTop: 90 }}>
                <h3 style={{ fontSize: "1.2rem", margin: "0 0 10px", color: "var(--pe-text)" }}>{e.term}</h3>
                <p style={{ margin: "0 0 12px", lineHeight: 1.75, color: "var(--pe-text)" }}>{e.definition}</p>
                <p style={{ margin: 0, fontSize: 14, color: "var(--pe-mute)", lineHeight: 1.7 }}>
                  <Link href={`/glossary/${e.id}`} style={{ color: "var(--pe-gold-hi)" }}>Full explanation with an example</Link>
                  {" "}| Source: <a href={e.source.url} rel="noopener noreferrer" style={{ color: "var(--pe-gold-hi)" }}>{e.source.label}</a>
                  {e.related ? (
                    <>
                      {" "}| Related: <Link href={e.related.href} style={{ color: "var(--pe-gold-hi)" }}>{e.related.label}</Link>
                    </>
                  ) : null}
                </p>
              </article>
            ))}
          </section>
        ))}

        <section className="pe-card" style={{ padding: 26 }}>
          <p className="pe-kicker">See where your own domain stands</p>
          <p style={{ margin: "0 0 14px", lineHeight: 1.7 }}>
            The email terms above are checkable in a few minutes from public records. Titanos runs a free external check on a domain you ask us to look at, and the Privacy Act and Essential Eight pack covers the rest.
          </p>
          <Link href="/scan" className="pe-textlink">Run the free domain check</Link>{" "}
          <Link href="/compliance" className="pe-textlink">See the Privacy Act and Essential Eight pack</Link>
        </section>
      </div>
    </>
  );
}
