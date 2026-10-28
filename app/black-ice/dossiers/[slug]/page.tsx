import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withSeo } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { article } from "@/lib/jsonld";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import BlogBody from "@/components/BlogBody";
import { SystemLabel } from "@/components/Myth";
import { publishedDossiers, getDossier, SITE_DOSSIER_BASE } from "@/lib/black-ice/dossiers";
import s from "@/components/w2b/blog.module.css";

// Only published dossiers are emitted. An unpublished slug has no page at all (dynamicParams is false under export).
export function generateStaticParams() {
  return publishedDossiers().map((d) => ({ slug: d.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = getDossier(slug);
  if (!d) return {};
  const url = `${SITE_DOSSIER_BASE}/${d.slug}`;
  return withSeo(`/black-ice/dossiers/${d.slug}`, {
    title: `${d.title} | Titanos`,
    description: d.description,
    alternates: { canonical: url },
    openGraph: { title: d.title, description: d.description, type: "article", url, publishedTime: d.date },
    robots: { index: true, follow: true },
  });
}

const Paras = ({ text }: { text: string }) => (
  <>
    {text.split("\n\n").map((t, i) => (
      <p key={i} className={s.p}>{t}</p>
    ))}
  </>
);

const Lines = ({ text }: { text: string }) => (
  <>
    {text.split("\n").map((t, i) => (
      <p key={i} className={s.p}>{t}</p>
    ))}
  </>
);

export default async function DossierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = getDossier(slug);
  if (!d) notFound();

  const url = `${SITE_DOSSIER_BASE}/${d.slug}`;
  const related = (d.relatedSlugs ?? []).map((r) => getDossier(r)).filter((x): x is NonNullable<typeof x> => !!x);
  const review = d.review.replace(/_/g, " ");

  return (
    <>
      <JsonLd data={article({ path: `/black-ice/dossiers/${d.slug}`, headline: d.title, description: d.description, datePublished: d.date, dateModified: d.updated || d.date })} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://titanos.tech/" },
            { "@type": "ListItem", position: 2, name: "Black Ice", item: "https://titanos.tech/black-ice" },
            { "@type": "ListItem", position: 3, name: "Dossiers", item: SITE_DOSSIER_BASE },
            { "@type": "ListItem", position: 4, name: d.title, item: url },
          ],
        }}
      />
      <PageHero badge={`BLACK ICE · ${d.rung}`} title={d.title} />
      <div className="divider-gold" />
      <SectionReveal style={{ padding: "var(--space-16) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <div className={s.meta}>
            <Link href="/black-ice/dossiers" className={s.back}>← All dossiers</Link>
            <SystemLabel>
              <span data-rung={d.rung}>Evidence label: {d.rung}</span> · Review: {review} · {d.contentId}
            </SystemLabel>
          </div>

          <div className={s.prose}>
            <p className={s.p}><strong>Claimed:</strong> {d.claimedVsTested.claimed}</p>
            <p className={s.p}><strong>Tested:</strong> {d.claimedVsTested.tested}</p>
          </div>

          <BlogBody blocks={d.body} />

          {d.asset && (
            <div className={s.prose}>
              <h2 className={s.h2}>{d.asset.title}</h2>
              {d.asset.items.map((item, i) => (
                <pre key={i} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "var(--text)", fontSize: "0.85rem", lineHeight: 1.6, margin: "0 0 1.2em" }}>{item}</pre>
              ))}
            </div>
          )}

          <div className={s.prose}>
            <h2 className={s.h2}>Part 6. The strongest fair objection</h2>
            <Paras text={d.objection} />

            <h2 className={s.h2}>Part 7. What this does not prove</h2>
            <ul className={s.list}>{d.doesNotProve.map((x, i) => <li key={i}>{x}</li>)}</ul>

            <h2 className={s.h2}>Part 8. Limitations and exclusions</h2>
            <ul className={s.list}>{d.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul>

            <h2 className={s.h2}>Part 9. Evidence and sources</h2>
            <ul className={s.list}>
              {d.sources.map((x, i) => (
                <li key={i}>
                  <strong>{x.label}:</strong> {x.note}
                  {x.url && <> <a href={x.url} className={s.link} rel="noopener noreferrer">{x.url}</a></>}
                </li>
              ))}
            </ul>

            <h2 className={s.h2}>Part 10. Buyer reading and builder reading</h2>
            <h3 className={s.h3}>If you are a buyer</h3>
            <Lines text={d.buyerReading} />
            <h3 className={s.h3}>If you are a builder or vendor</h3>
            <Lines text={d.builderReading} />

            <h2 className={s.h2}>Part 11. Corrections</h2>
            {d.corrections.length === 0 ? (
              <p className={s.p}>No corrections yet. Material changes will be listed here with their date.</p>
            ) : (
              <ul className={s.list}>{d.corrections.map((c, i) => <li key={i}><strong>{c.date}:</strong> {c.note}</li>)}</ul>
            )}

            <h2 className={s.h2}>Part 12. {d.cta.question}</h2>
            {d.cta.commercial && <Paras text={d.cta.commercial} />}

            {related.length > 0 && (
              <>
                <h2 className={s.h2}>Related dossiers</h2>
                <ul className={s.list}>
                  {related.map((r) => <li key={r.slug}><Link href={`/black-ice/dossiers/${r.slug}`} className={s.link}>{r.title}</Link></li>)}
                </ul>
              </>
            )}
            {d.image && <p className={s.p}><em>Image: {d.image.caption}</em></p>}
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
