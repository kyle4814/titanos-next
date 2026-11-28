import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withSeo, SITE } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { article, breadcrumbs, faqPage } from "@/lib/jsonld";
import { GUIDES, getGuide, guideWordCount } from "@/lib/guides";
import { getPostBySlug } from "@/lib/blog";
import RelatedReading from "@/components/seo/RelatedReading";
import GuideBlocks from "@/components/guides/GuideBlocks";
import Inline from "@/components/guides/Inline";
import "@/components/home-redesign/home-redesign.css";
import "@/components/guides/guides.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  const url = `${SITE}/guides/${g.slug}`;
  return withSeo(`/guides/${g.slug}`, {
    title: `${g.seoTitle} | Titanos`,
    description: g.description,
    alternates: { canonical: url },
    openGraph: { title: g.seoTitle, description: g.description, type: "article", url, publishedTime: g.date, modifiedTime: g.updated, authors: ["Kyle Deligny"] },
    robots: { index: true, follow: true },
  });
}

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d} ${M[m - 1]} ${y}`;
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  const path = `/guides/${g.slug}`;
  const posts = g.related.posts.map((s) => getPostBySlug(s)).filter((p): p is NonNullable<typeof p> => !!p);
  const others = GUIDES.filter((x) => x.slug !== g.slug);
  const mins = Math.max(1, Math.round(guideWordCount(g) / 230));
  return (
    <div className="gd-page" lang="en-AU">
      <JsonLd data={article({ path, headline: g.h1, description: g.description, datePublished: g.date, dateModified: g.updated, authorPath: "/authors/kyle-deligny" })} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }, { name: g.h1, path }])} />
      <JsonLd data={faqPage(g.faq)} />
      <div className="gd-wrap">
        <nav className="gd-crumbs" aria-label="Breadcrumb">
          <ol>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/guides">Guides</Link></li>
            <li aria-current="page">{g.cluster}</li>
          </ol>
        </nav>
        <header className="gd-hero">
          <p className="gd-kicker">{g.cluster}</p>
          <h1>{g.h1}</h1>
          <p className="gd-by">
            By <strong><Link href="/authors/kyle-deligny" rel="author">Kyle Deligny</Link></strong>, Brisbane. Published {longDate(g.date)}. Last reviewed {longDate(g.updated)}. <Link href="/editorial-policy">How we write and check</Link>. About {mins} minute read. General information, not legal advice.
          </p>
        </header>
        <div className="gd-layout">
          <nav className="gd-toc" aria-label="In this guide">
            <details open>
              <summary>In this guide</summary>
              <ol>
                {g.sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.h2}</a></li>)}
                <li><a href="#faq">Questions people ask</a></li>
                <li><a href="#go-deeper">Go deeper</a></li>
                <li><a href="#sources">Sources</a></li>
              </ol>
            </details>
          </nav>
          <article className="gd-article">
            <section aria-label="Summary">
              <GuideBlocks blocks={[{ t: "note", title: "Short answer", x: g.answer }]} />
              <GuideBlocks blocks={g.intro} />
            </section>
            {g.sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
                <h2 id={`${s.id}-h`}>{s.h2}</h2>
                <GuideBlocks blocks={s.blocks} />
              </section>
            ))}
            <section id="faq" aria-labelledby="faq-h" className="gd-faq">
              <h2 id="faq-h">Questions people ask</h2>
              {g.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p><Inline text={f.a} /></p>
                </details>
              ))}
            </section>
            <section id="go-deeper" aria-labelledby="deeper-h" className="gd-deeper">
              <h2 id="deeper-h">Go deeper</h2>
              {posts.length > 0 && (
                <div>
                  <h3 className="gd-sub">Related blog posts</h3>
                  <ul className="gd-linkgrid">
                    {posts.map((p) => (
                      <li key={p.slug}><Link href={`/blog/${p.slug}`} className="gd-linkcard"><b>{p.title}</b><span>{p.excerpt}</span></Link></li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="gd-sub">Tools and checks</h3>
                <ul className="gd-linkgrid">
                  {g.related.tools.map((l) => <li key={l.href}><Link href={l.href} className="gd-linkcard"><b>{l.label}</b><span>{l.blurb}</span></Link></li>)}
                </ul>
              </div>
              <div>
                <h3 className="gd-sub">Products and the shop</h3>
                <ul className="gd-linkgrid">
                  {g.related.products.map((l) => <li key={l.href}><Link href={l.href} className="gd-linkcard"><b>{l.label}</b><span>{l.blurb}</span></Link></li>)}
                </ul>
              </div>
              <div>
                <h3 className="gd-sub">More guides</h3>
                <ul className="gd-linkgrid">
                  {others.map((o) => <li key={o.slug}><Link href={`/guides/${o.slug}`} className="gd-linkcard"><b>{o.h1}</b><span>{o.cluster}</span></Link></li>)}
                </ul>
              </div>
              <div className="gd-cta">
                <p><Inline text={g.nextStep.text} /></p>
                <Link href={g.nextStep.href} className="gd-btn">{g.nextStep.label}</Link>
                <p className="gd-legal">This guide is general information for Australian small businesses, not legal, tax or financial advice. Laws and programs change: check the linked primary sources and ask a qualified adviser about your own situation.</p>
              </div>
            </section>
            <RelatedReading path={path} />
            <section id="sources" aria-labelledby="sources-h" className="gd-sources">
              <h2 id="sources-h">Sources</h2>
              <ol>
                {g.sources.map((s) => (
                  <li key={s.url}><a href={s.url} rel="noopener noreferrer">{s.label}</a>{s.note ? <span>. {s.note}</span> : null}</li>
                ))}
              </ol>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}
