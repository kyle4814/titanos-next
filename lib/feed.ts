// RSS 2.0 feed generated from the blog index (lib/blog.ts). Pure function so the test can render it without Next.
import { SITE } from "@/lib/seo";
import { postsSortedByDate, type BlogPost } from "@/lib/blog";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const rfc822 = (iso: string) => new Date(`${iso}T00:00:00+10:00`).toUTCString();

export function renderFeed(posts: BlogPost[] = postsSortedByDate(), site: string = SITE): string {
  const items = posts.map((p) => {
    const url = `${site}/blog/${p.slug}`;
    return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(p.updated ?? p.date)}</pubDate>
      <category>${esc(p.tag)}</category>
      <description>${esc(p.description)}</description>
    </item>`;
  });
  const last = posts.length ? rfc822(posts[0].updated ?? posts[0].date) : new Date(0).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>TITANOS blog</title>
    <link>${site}/blog</link>
    <description>Notes on AI implementation, Privacy Act compliance and revenue already sitting in your business.</description>
    <language>en-AU</language>
    <lastBuildDate>${last}</lastBuildDate>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>
`;
}

export function feedResponse(): Response {
  return new Response(renderFeed(), { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
