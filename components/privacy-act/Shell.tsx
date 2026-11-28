import Link from "next/link";
import type { ReactNode } from "react";
import JsonLd from "@/components/JsonLd";
import { LAST_REVIEWED, LAST_REVIEWED_LONG } from "@/lib/privacyObligations";
import "@/components/home-redesign/home-redesign.css";
import "./privacy-act.css";

export const CHECKER_HREF = "/tools/privacy-act-checker";
export const SHOP_HREF = "/shop";
export const COMPLIANCE_HREF = "/compliance";

export type Crumb = { name: string; href?: string };

/** Hero block shared by the hub and the explainers: breadcrumbs, one H1, direct answer, byline, legal line. */
export function Hero({ crumbs, h1, answer }: { crumbs: Crumb[]; h1: string; answer: string }) {
  return (
    <header className="pe-hero po-hero">
      <div className="pe-wrap">
        <nav className="po-crumbs" aria-label="Breadcrumb">
          <ol>
            {crumbs.map((c, i) => (
              <li key={c.name} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                {c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.name}</Link> : c.name}
              </li>
            ))}
          </ol>
        </nav>
        <h1>{h1}</h1>
        <p className="po-answer">{answer}</p>
        <p className="po-meta">
          By <Link href="/about">Kyle Deligny</Link>, Titanos, Brisbane. Last reviewed <time dateTime={LAST_REVIEWED}>{LAST_REVIEWED_LONG}</time> against the Privacy Act 1988 (Compilation No. 104, 4 June 2026).
        </p>
        <p className="po-notice">General information, not legal advice. It describes the law as read on the review date for a small business owner. For a decision that matters, ask a privacy lawyer.</p>
      </div>
    </header>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section className="pe-wrap po-sec" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <h2 id={id ? `${id}-h` : undefined}>{title}</h2>
      {children}
    </section>
  );
}

export function Ld({ items }: { items: (Parameters<typeof JsonLd>[0]["data"])[] }) {
  return (
    <>
      {items.map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
    </>
  );
}

export function NextSteps({ lead }: { lead: string }) {
  return (
    <Section id="next" title="Where to go from here">
      <p>{lead}</p>
      <div className="po-cta">
        <Link href={CHECKER_HREF} className="pe-btn pe-btn--gold">Free Privacy Act checker</Link>
        <Link href={SHOP_HREF} className="pe-btn pe-btn--dark">Privacy template pack in the shop</Link>
        <Link href={COMPLIANCE_HREF} className="pe-btn pe-btn--dark">Privacy Act compliance with Titanos</Link>
      </div>
    </Section>
  );
}
