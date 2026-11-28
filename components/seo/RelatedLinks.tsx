import Link from "next/link";
import { TOOL_RELATED, GUIDE_LINKS, PRODUCT_LINKS, SHOP, toolLink, type RelLink } from "@/lib/seo-links";
import { POSTS } from "@/lib/blog";
import "./related-links.css";

/** Related guides, tools, posts and shop products for a /tools page. New pages only; pure server component. */
export default function RelatedLinks({ path }: { path: string }) {
  const r = TOOL_RELATED[path];
  if (!r) return null;
  const guides: RelLink[] = r.guides.map((s) => GUIDE_LINKS[s]);
  const tools: RelLink[] = [...r.tools.map(toolLink), { label: "All free tools", href: "/tools", blurb: "The full set of Australian small business tools." }];
  const products: RelLink[] = [...r.products.map((s) => PRODUCT_LINKS[s]), SHOP];
  const posts: RelLink[] = r.posts.flatMap((s) => {
    const p = POSTS.find((x) => x.slug === s);
    return p ? [{ label: p.title, href: `/blog/${p.slug}`, blurb: p.excerpt }] : [];
  });
  const groups: [string, RelLink[]][] = [["Guides", guides], ["More free tools", tools], ["From the blog", posts], ["In the shop", products]];
  return (
    <section className="rl" aria-labelledby="rl-h" data-related-links>
      <h2 id="rl-h">Keep going</h2>
      <div className="rl-grid">
        {groups.filter(([, l]) => l.length).map(([title, list]) => (
          <div key={title} className="rl-col">
            <h3>{title}</h3>
            <ul>{list.map((l) => <li key={l.href}><Link href={l.href}><b>{l.label}</b><span>{l.blurb}</span></Link></li>)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}
