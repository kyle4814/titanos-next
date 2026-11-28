import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { article, product, faqPage, breadcrumbs } from "@/lib/jsonld";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import BlogBody from "@/components/BlogBody";
import BlogPostCard from "@/components/BlogPostCard";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import { SystemLabel, OmegaSeal } from "@/components/Myth";
import { AUDIT_MESSAGE_HREF } from "@/lib/config";
import s from "@/components/w2b/blog.module.css";
import { POSTS, getPostBySlug, getRelatedPosts } from "@/lib/blog";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const url = `https://titanos.tech/blog/${post.slug}`;
  return withSeo(`/blog/${post.slug}`, {
    title: `${post.title} | Titanos`,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url,
      publishedTime: post.date,
    },
    robots: { index: true, follow: true },
  });
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post);
  const url = `https://titanos.tech/blog/${post.slug}`;

  const articleJsonLd = article({ path: `/blog/${post.slug}`, headline: post.title, description: post.description, datePublished: post.date, dateModified: post.updated || post.date });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://titanos.tech/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://titanos.tech/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  const faqJsonLd = faqPage(post.faq ?? []);

  return (
    <>
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />

      <div className={s.progress} aria-hidden="true" />
      <PageHero
        badge={post.tag.toUpperCase()}
        title={post.title}
      />

      <SectionReveal className="pe-section">
        <div className="pe-page pe-page--narrow">
          <div className={s.meta}>
            <Link href="/blog" className={s.back}>
              ← Back to the archive
            </Link>
            <SystemLabel>
              logged {formatDate(post.date)} · {post.readMinutes} min read
            </SystemLabel>
          </div>

          <BlogBody blocks={post.body} />

          <div className={s.end}>
            <OmegaSeal caption="Recovered document, end of record." style={{ margin: "0 auto" }} />
          </div>
        </div>
      </SectionReveal>

      {post.faq && post.faq.length > 0 && (
        <>
          <SectionReveal className="pe-section">
            <div className="pe-page pe-page--narrow">
              <p className="pe-eyebrow-line">On record</p>
              <h2 style={{ marginBottom: 20 }}>Questions on record
              </h2>
              {post.faq.map((item) => (
                <FaqItem key={item.q} question={item.q}>
                  {item.a}
                </FaqItem>
              ))}
            </div>
          </SectionReveal>
        </>
      )}

      {related.length > 0 && (
        <>
          <SectionReveal className="pe-section">
            <div className="pe-page">
              <p className="pe-eyebrow-line">Keep reading</p>
              <h2 style={{ marginBottom: 20 }}>Related records
              </h2>
              <div className={s.grid}>
                {related.map((r) => (
                  <BlogPostCard key={r.slug} post={r} />
                ))}
              </div>
            </div>
          </SectionReveal>
        </>
      )}

      <SectionReveal className="pe-section" style={{ textAlign: "center" }}>
        <div className="pe-page pe-page--narrow">
        <h2 style={{ marginBottom: 18 }}>Apply this to your own operation
        </h2>
        <p className="pe-lead" style={{ margin: "0 auto 26px" }}>
          15 minutes is enough to know if there's a real gap worth closing.
        </p>
        <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="primary">
          GET YOUR FREE AI AUDIT: MESSAGE KYLE
        </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
