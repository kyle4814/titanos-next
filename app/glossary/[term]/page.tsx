import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withSeo, SITE } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { article, breadcrumbs } from "@/lib/jsonld";
import { KYLE_ID } from "@/lib/entityJsonld";
import { GLOSSARY_PAGES, GLOSSARY_REVIEWED, getGlossaryPage } from "@/lib/glossaryPages";
import { GLOSSARY } from "@/lib/glossary";
import "@/components/home-redesign/home-redesign.css";
import "@/components/guides/guides.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return GLOSSARY_PAGES.map((p) => ({ term: p.entry.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ term: string }> }): Promise<Metadata> {
  const { term } = await params;
  const p = getGlossaryPage(term);
  if (!p) return {};
  const path = `/glossary/${p.entry.id}`;
  const url = `${SITE}${path}`;
  const title = p.title.replace(/ \| Titanos$/, "");
  return withSeo(path, {
    title: p.title,
    description: p.description,
    alternates: { canonical: url },
    openGraph: { title, description: p.description, type: "article", url, modifiedTime: GLOSSARY_REVIEWED, authors: ["Kyle Deligny"] },
    robots: { index: true, follow: true },
  });
}

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d} ${M[m - 1]} ${y}`;
}

export default async function GlossaryTermPage({ params }: { params: Promise<{ term: string }> }) {
  const { term } = await params;
  const p = getGlossaryPage(term);
  if (!p) notFound();
  const { entry, deep } = p;
  const path = `/glossary/${entry.id}`;
  const see = deep.see.map((id) => GLOSSARY_PAGES.find((x) => x.entry.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
  const definedTerm = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": `${SITE}${path}#term`,
    name: entry.term,
    termCode: entry.id,
    description: entry.definition,
    url: `${SITE}${path}`,
    inLanguage: "en-AU",
    inDefinedTermSet: `${SITE}/glossary#set`,
  };
  const h1 = `What is ${deep.name.replace(/^(the|an|a) /, "")}?`;
  return (
    <div className="gd-page" lang="en-AU">
      <JsonLd data={definedTerm} />
      <JsonLd data={article({ path, headline: h1, description: p.description, dateModified: GLOSSARY_REVIEWED })} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Glossary", path: "/glossary" }, { name: entry.term, path }])} />
      <div className="gd-wrap">
        <nav className="gd-crumbs" aria-label="Breadcrumb">
          <ol>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/glossary">Glossary</Link></li>
            <li aria-current="page">{entry.term}</li>
          </ol>
        </nav>
        <header className="gd-hero">
          <p className="gd-kicker">Glossary</p>
          <h1>{h1}</h1>
          <p className="gd-by">
            By <strong><Link href="/about">Kyle Deligny</Link></strong>, Brisbane. Last reviewed {longDate(GLOSSARY_REVIEWED)}. General information, not legal advice.
          </p>
        </header>
        <div className="gd-layout">
          <article className="gd-article">
            <section aria-label="Definition">
              <p><strong>{entry.term}.</strong> {entry.definition}</p>
            </section>
            <section id="how-it-works" aria-labelledby="how-h">
              <h2 id="how-h">How it works</h2>
              {deep.body.map((t, i) => <p key={i}>{t}</p>)}
            </section>
            <section id="example" aria-labelledby="example-h">
              <h2 id="example-h">{deep.example.title}</h2>
              <p>{deep.example.text}</p>
            </section>
            <section id="next-steps" aria-labelledby="steps-h">
              <h2 id="steps-h">What to do about it</h2>
              <ol>{deep.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </section>
            {deep.mistakes && deep.mistakes.length > 0 && (
              <section id="mistakes" aria-labelledby="mistakes-h">
                <h2 id="mistakes-h">Common mistakes</h2>
                <ul>{deep.mistakes.map((s) => <li key={s}>{s}</li>)}</ul>
              </section>
            )}
            <section id="go-deeper" aria-labelledby="deeper-h" className="gd-deeper">
              <h2 id="deeper-h">Related terms and tools</h2>
              {see.length > 0 && (
                <div>
                  <h3 className="gd-sub">Related terms</h3>
                  <ul className="gd-linkgrid">
                    {see.map((x) => (
                      <li key={x.entry.id}><Link href={`/glossary/${x.entry.id}`} className="gd-linkcard"><b>{x.entry.term}</b><span>{x.entry.definition.split(/(?<=[.?!])\s/)[0]}</span></Link></li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="gd-sub">Tools, guides and articles</h3>
                <ul className="gd-linkgrid">
                  {deep.links.map((l) => <li key={l.href}><Link href={l.href} className="gd-linkcard"><b>{l.label}</b></Link></li>)}
                </ul>
              </div>
              <div className="gd-cta">
                <p>See where your own domain stands. Titanos runs a free external check from public records only, and nothing on your systems is touched.</p>
                <Link href="/scan" className="gd-btn">Run the free domain check</Link>
                <p className="gd-legal">This page is general information for Australian small businesses, not legal, tax or financial advice. Check the linked primary source and ask a qualified adviser about your own situation.</p>
              </div>
            </section>
            <section id="sources" aria-labelledby="sources-h" className="gd-sources">
              <h2 id="sources-h">Source</h2>
              <ol>
                <li><a href={entry.source.url} rel="noopener noreferrer">{entry.source.label}</a></li>
              </ol>
              <p><Link href={`/glossary#${entry.id}`}>See this term in the full glossary</Link> ({GLOSSARY.length} terms).</p>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}
