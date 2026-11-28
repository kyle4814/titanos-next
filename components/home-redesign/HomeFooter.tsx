import Link from "next/link";
import PhiWordmark from "@/components/hero/PhiWordmark";
import Icon from "./Icon";

const COLS: { h: string; links: [string, string][] }[] = [
  { h: "Platform", links: [["How it works", "/how-it-works"], ["Engineering record", "/engineering"], ["Methodology", "/methodology"], ["Live HUD", "/hud"], ["Trust and safety", "/trust"]] },
  { h: "Products", links: [["All offers", "/offers"], ["AI Partnership", "/ai-delivery"], ["Compliance", "/compliance"], ["Monitor", "/monitor"], ["Verified leads", "/leads"], ["Free scan", "/scan"], ["Courses", "/courses"]] },
  { h: "Company", links: [["About", "/about"], ["Case studies", "/case-studies"], ["Proof", "/proof"], ["Evidence pack", "/our-evidence-pack"], ["The declaration", "/declaration"], ["Pricing", "/pricing"], ["Contact", "/contact"]] },
];

export default function HomeFooter() {
  const year = 2026; // fixed: static export, so a clock would bake in the build date
  return (
    <footer className="pe-footer" aria-label="Site footer">
      <div className="pe-wrap pe-footer__grid">
        <div className="pe-footer__brand">
          <Link href="/" className="pe-brand" aria-label="TITANOS home">
            <picture>
              <source type="image/webp" srcSet="/site-redesign/t-mark.webp" />
              <img src="/site-redesign/t-mark.png" alt="" width={40} height={40} className="pe-brand__mark" loading="lazy" />
            </picture>
            <PhiWordmark height={18} title="TITANOS" />
          </Link>
          <p>AI automation and engineering with the evidence kept. Kyle Deligny, Brisbane, Australia. ABN 34 318 502 254.</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.h} aria-label={c.h} className="pe-footer__col">
            <h2>{c.h}</h2>
            <ul>{c.links.map(([l, h]) => <li key={h}><Link href={h}>{l}</Link></li>)}</ul>
          </nav>
        ))}
        <div className="pe-card pe-ready">
          <h2>Ready to Build With TitanOS?</h2>
          <p>See the platform, the proof and what is possible for your business.</p>
          <Link href="/book" className="pe-btn pe-btn--gold">Book a free call <Icon name="arrow" size={16} stroke={2} /></Link>
        </div>
      </div>
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
