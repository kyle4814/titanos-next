import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import Icon from "./Icon";
import type { IconName } from "./Icon";
import { HERO_STRIP, dec, int, v } from "@/lib/ledger";
import { METRICS, SERVICES, STEPS, TRUST, CASE_OUTCOMES, PROOF_DOCS, ENGINE, ENGINE_SLUG } from "./homepageContent";

const HERO_W = [480, 768, 1199] as const;
const BLD_W = [640, 960, 1280, 1672] as const;
const set = (base: string, widths: readonly number[], ext: string) => widths.map((w) => `/site-redesign/${base}-${w}.${ext} ${w}w`).join(", ");

/** Real byte size of a file under public/, read at build time. Never typed in. */
function sizeOf(rel: string): string {
  const b = fs.statSync(path.join(process.cwd(), "public", rel)).size;
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
}

export function Hero() {
  return (
    <section className="pe-hero" aria-labelledby="pe-h1">
      <div className="pe-hero__media" aria-hidden="false">
        <picture>
          <source type="image/avif" srcSet={set("hero-mountain", HERO_W, "avif")} sizes="(max-width: 760px) 100vw, 62vw" />
          <source type="image/webp" srcSet={set("hero-mountain", HERO_W, "webp")} sizes="(max-width: 760px) 100vw, 62vw" />
          <img
            src="/site-redesign/hero-mountain-1199.webp" width={1199} height={1312} loading="eager" decoding="async" fetchPriority="high"
            alt="A giant gold-lit angular T rising behind a jagged black mountain ridge under storm cloud (AI-generated artwork)"
          />
        </picture>
      </div>
      <div className="pe-hero__copy pe-wrap">
        <p className="pe-eyebrow pe-rise" style={{ ["--d" as string]: "0ms" }}>AI <i>×</i> Automation <i>×</i> Proof <i>×</i> Enterprise</p>
        <h1 id="pe-h1" className="pe-rise" style={{ ["--d" as string]: "90ms" }}>The Proof<br />Economy is <em>Live</em></h1>
        <p className="pe-sub pe-rise" style={{ ["--d" as string]: "160ms" }}>
          AI engineering and automation built for real operations. See the working systems, the tests behind them and the evidence for every figure.
        </p>
        <div className="pe-cta-row pe-rise" style={{ ["--d" as string]: "230ms" }}>
          <Link href="/offers" className="pe-btn pe-btn--gold pe-btn--lg">See what we build <Icon name="arrow" size={18} stroke={2} /></Link>
          <Link href="/proof" className="pe-btn pe-btn--dark pe-btn--lg"><Icon name="play" size={14} stroke={2} /> View Proof</Link>
        </div>
      </div>
    </section>
  );
}

export function Metrics() {
  return (
    <section className="pe-wrap pe-metrics" aria-label="Measured figures">
      <ul>
        {METRICS.map((m) => (
          <li key={m.id} className="pe-card pe-metric">
            <span className="pe-ico"><Icon name={m.icon as IconName} size={24} /></span>
            <div>
              <p className="pe-metric__v">{m.value}</p>
              <p className="pe-metric__t">{m.title}</p>
              <p className="pe-metric__s">{m.scope}</p>
              <Link href={m.href} className="pe-metric__src">{m.status} · {m.hrefLabel} <Icon name="arrow" size={12} stroke={2} /></Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Receipts() {
  return (
    <section className="pe-wrap pe-receipts" aria-labelledby="pe-receipts-h">
      <div className="pe-receipts__lead">
        <p className="pe-kicker">Proof layer</p>
        <h2 id="pe-receipts-h">Receipts, Not Claims.</h2>
        <p>Real files you can open: a dated declaration, a sample report and a commit-by-commit build log.</p>
      </div>
      <ul className="pe-receipts__cards">
        {PROOF_DOCS.map((d) => (
          <li key={d.href} className="pe-card pe-doc">
            <span className="pe-ico pe-ico--sm"><Icon name="doc" size={20} /></span>
            <div className="pe-doc__body">
              <h3>{d.title}</h3>
              <p>{d.sub}</p>
              <a href={d.href} className="pe-doc__dl" target="_blank" rel="noopener noreferrer" aria-label={`Open ${d.title} (${d.kind}, ${sizeOf(d.file)}) in a new tab`}>
                <span>{d.kind} · {sizeOf(d.file)}</span>
                <Icon name="download" size={15} stroke={2} />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Systems() {
  return (
    <section className="pe-wrap pe-systems" aria-labelledby="pe-systems-h">
      <div className="pe-head">
        <div>
          <p className="pe-kicker">What we build</p>
          <h2 id="pe-systems-h">Elite Systems for a Measured AI Economy.</h2>
        </div>
        <Link href="/products" className="pe-textlink">Explore All Products <Icon name="arrow" size={16} stroke={2} /></Link>
      </div>
      <ul className="pe-systems__grid">
        {SERVICES.map((s, i) => (
          <li key={s.title}>
            <Link href={s.href} className={`pe-card pe-service${i === 0 ? " pe-service--lead" : ""}`} aria-label={s.aria}>
              <div className="pe-service__t"><Icon name={s.icon as IconName} size={24} /> <h3>{s.title}</h3></div>
              <span className="pe-service__b">{s.body}</span>
              <span className="pe-service__go" aria-hidden="true"><Icon name="arrow" size={20} stroke={1.8} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CaseStudy() {
  return (
    <section className="pe-wrap pe-case" aria-labelledby="pe-case-h">
      <div className="pe-case__text">
        <p className="pe-kicker">Case study · <span className="pe-tag">{ENGINE.label}</span></p>
        <h2 id="pe-case-h">Our own engine: {ENGINE.facts[0][0]} work commits, tested and receipted</h2>
        <p>
          One person directing an AI orchestrator and a separate builder, with five human gates on anything that matters. It held a 48-hour soak test
          on 18 November 2026. This is a record of our own system, not a customer result.
        </p>
        <Link href={`/case-studies/${ENGINE_SLUG}`} className="pe-btn pe-btn--gold">View Full Case Study <Icon name="arrow" size={16} stroke={2} /></Link>
      </div>
      <div className="pe-case__visual">
        <figure className="pe-case__fig">
          <picture>
            <source type="image/avif" srcSet={set("building-concept", BLD_W, "avif")} sizes="(max-width: 760px) 100vw, 60vw" />
            <source type="image/webp" srcSet={set("building-concept", BLD_W, "webp")} sizes="(max-width: 760px) 100vw, 60vw" />
            <img
              src="/site-redesign/building-concept-1280.webp" width={1672} height={941} loading="lazy" decoding="async"
              alt="Illustrative render: a dark glass office corner at dusk with a gold lit TITANOS sign. An AI-generated concept image, not a real building"
            />
          </picture>
          <figcaption>Illustrative render. AI-generated architectural concept, not a real TITANOS office and not a customer.</figcaption>
        </figure>
        <aside className="pe-outcome" aria-label="The record, from the case study">
          <p className="pe-tag pe-tag--pill">The record</p>
          <ul>
            {CASE_OUTCOMES.map((o) => (
              <li key={o.label}>
                <Icon name={o.icon as IconName} size={20} />
                <strong>{o.value}</strong>
                <span>{o.label}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

export function Model() {
  return (
    <section className="pe-wrap pe-model" aria-labelledby="pe-model-h">
      <div className="pe-head">
        <div>
          <p className="pe-kicker">The system</p>
          <h2 id="pe-model-h">The TitanOS Operating Model</h2>
        </div>
        <p className="pe-head__side">A simple workflow that turns an idea into a measured result, with the evidence kept.</p>
      </div>
      <ol className="pe-model__steps">
        {STEPS.map((s, i) => (
          <li key={s.n} className="pe-card pe-step">
            <span className="pe-ico"><Icon name={s.icon as IconName} size={26} /></span>
            <div>
              <h3>{s.n}. {s.title}</h3>
              <p>{s.body}</p>
            </div>
            {i < STEPS.length - 1 && <span className="pe-step__arrow" aria-hidden="true"><Icon name="arrow" size={18} stroke={1.8} /></span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Trust() {
  return (
    <section className="pe-wrap pe-trust" aria-label="How we work">
      <p className="pe-trust__lead">Built for operators who want receipts</p>
      <ul>
        {TRUST.map((t) => <li key={t.label}><Icon name={t.icon as IconName} size={18} /> {t.label}</li>)}
      </ul>
    </section>
  );
}

/** Early door to the offer finder (kept from the previous homepage): it runs in the browser and sends nothing anywhere. */
export function FindOffer() {
  return (
    <section className="pe-wrap pe-find" aria-labelledby="pe-find-h">
      <div>
        <h2 id="pe-find-h">Find the right offer in 30 seconds</h2>
        <p>Answer a few plain questions and get pointed to the page that fits your business. It runs in your browser, nothing is sent anywhere, and a no is fine.</p>
      </div>
      <div className="pe-cta-row">
        <Link href="/find" className="pe-btn pe-btn--gold">Find the right offer <Icon name="arrow" size={16} stroke={2} /></Link>
        <Link href="/offers" className="pe-btn pe-btn--dark">See every offer</Link>
      </div>
    </section>
  );
}

/** The previous homepage hero claim, kept in full and labelled MODELLED exactly as before (engineer-years, ledger-bound). */
export function LedgerLine() {
  return (
    <section className="pe-wrap pe-ledgerline" aria-label="The modelled build estimate">
      <p className="pe-kicker">The birth of a global intelligence system, measured on itself</p>
      <h2>{dec("estate_ey")} engineer-years of output in {Math.round(v("elapsed_months"))} months.</h2>
      <p>{HERO_STRIP}</p>
      <p>
        In one day the cost of a matched job fell from US${v("cost_job_before").toFixed(2)} to US${v("cost_job_after").toFixed(2)} (25 jobs, same tasks), and the main engine carries {int("tests_main")} test cases. We did not buy a bigger machine. We changed the system.{" "}
        <Link href="/proof">See the receipts →</Link>
      </p>
    </section>
  );
}
