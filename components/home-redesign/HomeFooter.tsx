import Link from "next/link";
import PhiWordmark from "@/components/hero/PhiWordmark";
import Icon from "./Icon";
import { LINKS } from "@/lib/navLinks";

const COLS: { h: string; links: [string, string][] }[] = [
  { h: "Platform", links: [["How it works", "/how-it-works"], ["Engineering record", "/engineering"], ["Methodology", "/methodology"], ["Live HUD", "/hud"], ["Trust and safety", "/trust"], ["The learning loop", "/learning-loop"]] },
  { h: "Products", links: [["All offers", "/offers"], ["AI Partnership", "/ai-delivery"], ["Compliance", "/compliance"], ["Monitor", "/monitor"], ["Verified leads", "/leads"], ["Free scan", "/scan"], ["Courses", "/courses"], ["Free AI Readiness Guide (PDF)", "/ai-readiness-guide.pdf"]] },
  { h: "Company", links: [["About", "/about"], ["Case studies", "/case-studies"], ["Proof", "/proof"], ["Evidence pack", "/our-evidence-pack"], ["The declaration", "/declaration"], ["Pricing", "/pricing"], ["FAQ", "/faq"], ["Sectors", "/sectors"], ["The deep field", "/deep-field"], ["Contact", "/contact"]] },
];

// Links the previous site footer carried that are not in lib/navLinks.ts LINKS: kept reachable in the collapsed "All pages" list.
const EXTRA: [string, string][] = [
  ["Sectors", "/sectors"], ["Courses", "/courses"], ["The declaration", "/declaration"], ["Engineering record", "/engineering"],
  ["The learning loop", "/learning-loop"], ["The deep field", "/deep-field"], ["FAQ", "/faq"], ["How it works", "/how-it-works"],
  ["Security and privacy", "/security"], ["Our scan", "/scan#self-scan"], ["Image credits", "/credits"], ["Privacy", "/privacy"], ["Terms", "/terms"],
];
const ALL_PAGES: [string, string][] = [...LINKS.map((l): [string, string] => [l.label, l.href]), ...EXTRA.filter(([, h]) => !LINKS.some((l) => l.href === h))];

export default function HomeFooter() {
  const year = 2026; // fixed: static export, so a clock would bake in the build date
  return (
    <footer className="pe-footer" aria-label="Site footer">
      <div className="pe-wrap pe-footer__grid">
        <div className="pe-footer__brand">
          <Link href="/" className="pe-brand" aria-label="TITANOS home">
            <picture>
              <source type="image/webp" srcSet="/site-redesign/t-mark.webp" />
              <img src="/site-redesign/t-mark.png" alt="" width={40} height={40} className="pe-brand__mark" loading="lazy" decoding="async" />
            </picture>
            <PhiWordmark height={18} title="TITANOS" />
          </Link>
          <p>AI automation and engineering with the evidence kept. Kyle Deligny, Brisbane, Australia. ABN 34 318 502 254.</p>
          
          <p className="pe-footer__tag">Built without asking. Kept honest by what you can check. I personally review every deliverable before it reaches you.</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.h} aria-label={c.h} className="pe-footer__col">
            <h2>{c.h}</h2>
            <ul>{c.links.map(([l, h]) => <li key={h}>{h.endsWith(".pdf") ? <a href={h} target="_blank" rel="noopener noreferrer">{l}</a> : <Link href={h}>{l}</Link>}</li>)}</ul>
          </nav>
        ))}
        <div className="pe-card pe-ready">
          <h2>Ready to Build With TitanOS?</h2>
          <p>See the platform, the proof and what is possible for your business.</p>
          <Link href="/book" className="pe-btn pe-btn--gold">Book a free call <Icon name="arrow" size={16} stroke={2} /></Link>
        </div>
      </div>
      <details className="pe-wrap pe-allpages">
        <summary>All pages</summary>
        <ul>{ALL_PAGES.map(([l, h]) => <li key={h}><Link href={h}>{l}</Link></li>)}</ul>
      </details>
      <div className="pe-wrap pe-footer__legal">
        <p>&copy; {year} TITANOS. All rights reserved.</p>
        <ul>
          <li><Link href="/terms">Terms</Link></li>
          <li><Link href="/privacy">Privacy</Link></li>
          <li><Link href="/security">Security</Link></li>
          <li><Link href="/credits">Image credits</Link></li>
        </ul>
      </div>
    </footer>
  );
}
