import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withSeo } from "@/lib/seo";
import { article, breadcrumbs, faqPage } from "@/lib/jsonld";
import { OBLIGATIONS, getObligation, LAST_REVIEWED } from "@/lib/privacyObligations";
import { Hero, Section, Ld, NextSteps, CHECKER_HREF } from "@/components/privacy-act/Shell";

export const dynamicParams = false;

export function generateStaticParams() {
  return OBLIGATIONS.map((o) => ({ obligation: o.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ obligation: string }> }): Promise<Metadata> {
  const { obligation } = await params;
  const o = getObligation(obligation);
  if (!o) return {};
  const path = `/privacy-act/${o.slug}`;
  return withSeo(path, {
    title: o.title,
    description: o.description,
    alternates: { canonical: `https://titanos.tech${path}` },
    openGraph: { title: o.title, description: o.description, type: "article", url: `https://titanos.tech${path}` },
    robots: { index: true, follow: true },
  });
}

export default async function ObligationPage({ params }: { params: Promise<{ obligation: string }> }) {
  const { obligation } = await params;
  const o = getObligation(obligation);
  if (!o) notFound();
  const path = `/privacy-act/${o.slug}`;
  const art = {
    ...article({ path, headline: o.h1, description: o.description, datePublished: LAST_REVIEWED, dateModified: LAST_REVIEWED }),
    author: { "@type": "Person", name: "Kyle Deligny", url: "https://titanos.tech/about" },
    inLanguage: "en-AU",
  };
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Privacy Act", href: "/privacy-act" },
    { name: o.short },
  ];
  const sibs = o.related.map((s) => OBLIGATIONS.find((x) => x.slug === s)).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <>
      <Ld
        items={[
          art,
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "Privacy Act", path: "/privacy-act" },
            { name: o.short, path },
          ]),
          faqPage(o.faq),
        ]}
      />
      <Hero crumbs={crumbs} h1={o.h1} answer={o.answer} />

      <Section id="who" title="Who it applies to">
        <ul className="po-list">{o.appliesTo.map((t) => <li key={t}>{t}</li>)}</ul>
        <p>
          Not sure whether the Act covers your business at all? Start with the <Link href="/privacy-act/small-business-exemption">small business exemption explainer</Link> or run the <Link href={CHECKER_HREF}>free checker</Link>.
        </p>
      </Section>

      <Section id="requires" title="What it requires">
        {o.requires.map((r) => (
          <div key={r.heading}>
            <h3>{r.heading}</h3>
            <p>{r.body}</p>
          </div>
        ))}
      </Section>

      <Section id="example" title={o.example.heading}>
        <p>{o.example.scenario}</p>
        <ol className="po-steps">{o.example.walk.map((w) => <li key={w}>{w}</li>)}</ol>
        <p className="po-take"><strong>What to take from it. </strong>{o.example.takeaway}</p>
        <p>The scenario is an illustration written for this page, not a real client or a decision of the regulator.</p>
      </Section>

      <Section id="checklist" title="Checklist">
        <ul className="po-check">{o.checklist.map((c) => <li key={c}>{c}</li>)}</ul>
        <h3>Common traps</h3>
        <ul className="po-list">{o.traps.map((t) => <li key={t}>{t}</li>)}</ul>
      </Section>

      <Section id="faq" title="Questions people ask">
        <div className="po-faq">
          {o.faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section id="sources" title="Primary sources">
        <p>Checked on 28 November 2026. Links go to the Federal Register of Legislation and the OAIC.</p>
        <ul className="po-src">
          {o.sources.map((s) => (
            <li key={s.url + s.label}>
              <a href={s.url} rel="noopener">{s.label}</a>
              <span>{s.note}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="related" title="Related obligations">
        <ul className="po-sib">
          <li><Link href="/privacy-act">All six Privacy Act obligations explained</Link></li>
          {sibs.map((s) => (
            <li key={s.slug}><Link href={`/privacy-act/${s.slug}`}>{s.short}: {s.h1}</Link></li>
          ))}
        </ul>
      </Section>

      <NextSteps lead="Check where you stand with the free checker, use the privacy template pack for the documents, or have Titanos set the lot up with you in a working call." />
    </>
  );
}
