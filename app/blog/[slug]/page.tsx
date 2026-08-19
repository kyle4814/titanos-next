import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import BlogBody from "@/components/BlogBody";
import BlogPostCard from "@/components/BlogPostCard";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import { AUDIT_BOOK_HREF } from "@/lib/config";
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
  return {
    title: `${post.title} — Titanos`,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url,
      publishedTime: post.date,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: ["/og-image.png"] },
    robots: { index: true, follow: true },
  };
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

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    url,
    author: { "@type": "Person", name: "Kyle Deligny" },
    publisher: {
      "@type": "Organization",
      name: "Titanos",
      url: "https://titanos.tech",
      logo: "https://titanos.tech/apple-touch-icon.png",
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://titanos.tech/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://titanos.tech/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  const faqJsonLd = post.faq?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <PageHero
        badge={post.tag.toUpperCase()}
        title={post.title}
        sub={`${formatDate(post.date)} · ${post.readMinutes} min read`}
      />

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <Link
            href="/blog"
            style={{
              display: "inline-block",
              marginBottom: 32,
              color: "var(--dim)",
              fontSize: "var(--fs-sm)",
            }}
          >
            ← Back to the blog
          </Link>

          <BlogBody blocks={post.body} />
        </div>
      </SectionReveal>

      {post.faq && post.faq.length > 0 && (
        <>
          <div className="divider-gold" />
          <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
            <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
              <h2
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--gold)",
                  fontSize: "var(--fs-h3)",
                  letterSpacing: "0.06em",
                  marginBottom: 20,
                }}
              >
                QUICK ANSWERS
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
          <div className="divider-gold" />
          <SectionReveal style={{ padding: "var(--space-16) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
            <div style={{ maxWidth: "var(--maxw-wide)", margin: "0 auto" }}>
              <h2
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--gold)",
                  fontSize: "var(--fs-h3)",
                  letterSpacing: "0.06em",
                  marginBottom: 20,
                }}
              >
                RELATED
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 20,
                }}
              >
                {related.map((r) => (
                  <BlogPostCard key={r.slug} post={r} />
                ))}
              </div>
            </div>
          </SectionReveal>
        </>
      )}

      <div className="divider-gold" />

      <SectionReveal
        style={{
          textAlign: "center",
          padding: "var(--space-16) 20px var(--space-30)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            letterSpacing: "0.06em",
            marginBottom: 18,
          }}
        >
          WANT THIS APPLIED TO YOUR BUSINESS?
        </h2>
        <p
          style={{
            color: "var(--text)",
            fontSize: "var(--fs-lg)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 26px",
            lineHeight: 1.7,
          }}
        >
          15 minutes is enough to know if there's a real gap worth closing.
        </p>
        <AnimatedButton href={AUDIT_BOOK_HREF} variant="primary">
          BOOK YOUR FREE AI AUDIT CALL
        </AnimatedButton>
      </SectionReveal>
    </>
  );
}
