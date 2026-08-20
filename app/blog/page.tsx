import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import BlogPostCard from "@/components/BlogPostCard";
import { SystemLabel } from "@/components/Myth";
import { postsSortedByDate } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — Titanos",
  description:
    "Notes on AI implementation, Privacy Act compliance, and revenue that's already sitting in your business — written for AU trades and small-service operators.",
  alternates: { canonical: "https://titanos.tech/blog" },
  openGraph: {
    title: "Blog — Titanos",
    description:
      "Notes on AI implementation, Privacy Act compliance, and revenue that's already sitting in your business.",
    type: "website",
    url: "https://titanos.tech/blog",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

export default function BlogIndexPage() {
  const posts = postsSortedByDate();

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Titanos Blog",
    url: "https://titanos.tech/blog",
    publisher: {
      "@type": "Organization",
      name: "Titanos",
      url: "https://titanos.tech",
    },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `https://titanos.tech/blog/${p.slug}`,
      datePublished: p.date,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />
      <PageHero
        badge="FIELD NOTES"
        title="The archive"
        tagline="Notes recovered from the build — what an AI audit actually finds, what the Privacy Act reforms mean in plain English, and where the money already in your business is hiding."
        sub="Written for AU trades and small-service operators. No filler, no growth-hacker language."
      />

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-16) 20px var(--space-30)", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-wide)", margin: "0 auto" }}>
          <SystemLabel style={{ textAlign: "center", marginBottom: 32 }}>
            {String(posts.length).padStart(2, "0")} documents recovered · sorted by date logged
          </SystemLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {posts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
