import Link from "next/link";
import { RELATED_BLOCKS } from "@/lib/seo-related";
import "./related-links.css";

/** Contextual "Related reading" block for a guide or product page, driven by lib/seo-related.ts. Pure server component. */
export default function RelatedReading({ path }: { path: string }) {
  const blocks = RELATED_BLOCKS[path];
  if (!blocks?.length) return null;
  return (
    <section className="rl" aria-labelledby="rr-h" data-related-reading>
      <h2 id="rr-h">Related reading</h2>
      <div className="rl-grid">
        {blocks.map((b) => (
          <div key={b.title} className="rl-col">
            <h3>{b.title}</h3>
            <ul>{b.links.map((l) => <li key={l.href}><Link href={l.href}><b>{l.label}</b><span>{l.blurb}</span></Link></li>)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}
