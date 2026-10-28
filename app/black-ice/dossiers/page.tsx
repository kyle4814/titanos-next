import type { Metadata } from "next";
import Link from "next/link";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import { SystemLabel } from "@/components/Myth";
import { publishedDossiers } from "@/lib/black-ice/dossiers";
import s from "@/components/w2b/blog.module.css";

export const metadata: Metadata = withSeo("/black-ice/dossiers", {
  title: "Black Ice dossiers | Titanos",
  description:
    "Plain guides and free worksheets on buying and checking AI systems. Every page states its evidence label, its review status and what it does not prove.",
  alternates: { canonical: "https://titanos.tech/black-ice/dossiers" },
  robots: { index: true, follow: true },
});

export default function DossierIndexPage() {
  const list = publishedDossiers();
  return (
    <>
      <PageHero badge="BLACK ICE" title="Dossiers" sub="Guides and free worksheets. Each one says what it argues, what was tested, and what it does not prove." />
      <div className="divider-gold" />
      <SectionReveal style={{ padding: "var(--space-16) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <p className={s.p}>
            <Link href="/black-ice" className={s.link}>Back to Black Ice</Link>
          </p>
          {list.length === 0 ? (
            <p className={s.p}>The first dossiers are in preparation.</p>
          ) : (
            list.map((d) => (
              <div key={d.slug} style={{ marginBottom: "2rem" }}>
                <SystemLabel>
                  {d.rung} · review: {d.review.replace(/_/g, " ").toLowerCase()}
                </SystemLabel>
                <h2 className={s.h2}>
                  <Link href={`/black-ice/dossiers/${d.slug}`} className={s.link}>{d.title}</Link>
                </h2>
                <p className={s.p}>{d.excerpt}</p>
              </div>
            ))
          )}
        </div>
      </SectionReveal>
    </>
  );
}
