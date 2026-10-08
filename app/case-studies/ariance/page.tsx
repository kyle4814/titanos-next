import type { Metadata } from "next";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { ARIANCE as A, arianceVisible, between, clock } from "@/lib/case-studies/ariance";

const URL = "https://titanos.tech/case-studies/ariance";

export const metadata: Metadata = {
  title: `${A.title} | TITANOS`,
  description: A.teaser,
  alternates: { canonical: URL },
  openGraph: { title: A.title, description: A.teaser, type: "article", url: URL },
  // Consent gate: noindex until client_consent is true in lib/case-studies/ariance.json.
  robots: arianceVisible ? { index: true, follow: true } : { index: false, follow: false },
};

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 900, margin: "0 auto" };
const H: CSSProperties = { color: "var(--gold)", fontSize: 24, margin: "46px 0 12px" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };
const CARD: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "16px 18px",
};
const SMALL: CSSProperties = { color: "var(--ice)", opacity: 0.75, fontSize: 13, lineHeight: 1.5 };

export default function ArianceCaseStudy() {
  const sp = A.speed;
  const t = A.quality.tests;
  const firstBuild = sp.first_build_start;
  const totalBuild = between(firstBuild, sp.last_commit);
  const branchTotal = t.branch_notes.reduce((n, b) => n + b.tests_reported, 0);
  const facts: [string, string][] = [];
  if (totalBuild) facts.push([totalBuild, `from the first build start (${clock(firstBuild)}) to the last commit (${clock(sp.last_commit)}), Brisbane time`]);
  facts.push([String(sp.commits_total), "commits on the record"]);
  facts.push([`${t.tests_passed} / ${t.tests_passed + t.tests_failed}`, `tests passing on the main branch across ${t.files_passed} test files`]);
  if (t.branch_notes.length) facts.push([`+${branchTotal}`, "further tests reported on two branches waiting to be merged"]);
  facts.push([`US$${A.cost.hosting_monthly_usd}`, `planned monthly hosting cost (${A.cost.hosting_status.toLowerCase()}, not yet deployed)`]);

  return (
    <main>
      <PageHero badge={`Hero case study · ${A.sector}`} title={A.title} sub={A.teaser} />
      <section style={SECTION}>
        <div style={WRAP}>
          {!arianceVisible && (
            <p style={{ ...CARD, ...BODY, borderColor: "var(--gold-dim)", textAlign: "center" }}>
              Preview only. This page is hidden from search, the menu and the site map until the client has agreed to it going public.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            {facts.map(([n, l]) => (
              <div key={l} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 26, fontWeight: 700 }}>{n}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.5 }}>{l}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>{A.brief.heading}</h2>
          <p style={SMALL}>{A.brief.note}</p>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            {A.brief.points.map((p) => (
              <li key={p} style={{ marginBottom: 8 }}>{p}</li>
            ))}
          </ul>

          <h2 style={H}>{A.challenge.heading}</h2>
          {A.challenge.paragraphs.map((p) => (
            <p key={p} style={BODY}>{p}</p>
          ))}

          <h2 style={H}>{A.built.heading}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {A.built.items.map((b) => (
              <div key={b.name} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{b.name}</div>
                <div style={{ color: "var(--ice)", fontSize: 15, lineHeight: 1.6 }}>{b.detail}</div>
                <div style={{ ...SMALL, marginTop: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>{b.state}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>{sp.heading}</h2>
          <p style={BODY}>
            {sp.brief_received_at
              ? `Times below are measured from the brief, received at ${clock(sp.brief_received_at)}.`
              : "Times below are measured from the first build start, because the moment the brief arrived was not recorded in a source we can cite."}{" "}
            {sp.timezone_note}
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {sp.phases.map((p) => {
              const run = between(p.started, p.finished);
              const sinceStart = between(firstBuild, p.committed);
              return (
                <div key={p.id} style={{ ...CARD, display: "flex", flexWrap: "wrap", gap: "6px 20px", alignItems: "baseline" }}>
                  <div style={{ color: "var(--ice)", fontSize: 16, flex: "1 1 260px" }}>{p.label}</div>
                  <div style={{ ...SMALL, flex: "0 1 auto" }}>
                    {run ? `${run} of build time (${clock(p.started as string)} to ${clock(p.finished as string)})` : "build window not logged"}
                  </div>
                  <div style={{ ...SMALL, flex: "0 1 auto" }}>
                    commit {p.commit} at {clock(p.committed)}
                    {sinceStart ? `, ${sinceStart} after the first start` : ""}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ ...SMALL, marginTop: 10 }}>{sp.commits_note}</p>

          <h2 style={H}>{A.quality.heading}</h2>
          <p style={BODY}>
            On the main branch, {t.tests_passed} of {t.tests_passed + t.tests_failed} tests passed across {t.files_passed} files when
            we ran them at {clock(t.measured_at)}. {A.quality.what_is_tested}
            {t.total_after_merge === null
              ? " Two further branches report their own test counts and are not merged yet, so no combined total is claimed."
              : ` Combined after merge: ${t.total_after_merge}.`}
          </p>

          <h3 style={{ ...H, fontSize: 19, margin: "30px 0 8px" }}>{A.quality.status_chip_heading}</h3>
          <p style={BODY}>{A.quality.status_chip_intro}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10 }}>
            {A.quality.status_chips.map((c) => (
              <div key={c.label} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 13, letterSpacing: 1.2, fontWeight: 700 }}>{c.label}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.55, marginTop: 4 }}>{c.meaning}</div>
              </div>
            ))}
          </div>
          <p style={{ ...BODY, marginTop: 14 }}>{A.quality.infographic_rule}</p>

          <h3 style={{ ...H, fontSize: 19, margin: "30px 0 8px" }}>{A.quality.findings_heading}</h3>
          <p style={BODY}>
            {A.quality.findings_intro}
            {A.quality.findings_delivered_at ? ` Handed over on ${A.quality.findings_delivered_at.slice(0, 10)}.` : ""}
          </p>
          <ol style={{ ...BODY, paddingLeft: 22 }}>
            {A.quality.findings.map((f) => (
              <li key={f.title} style={{ marginBottom: 12 }}>
                <strong style={{ color: "var(--gold)" }}>{f.title}.</strong> {f.text}
              </li>
            ))}
          </ol>

          <h3 style={{ ...H, fontSize: 19, margin: "30px 0 8px" }}>{A.quality.gallery_heading}</h3>
          <p style={SMALL}>{A.quality.gallery_note}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, marginTop: 12 }}>
            {A.quality.gallery.map((g) => (
              <figure key={g.id} style={{ ...CARD, margin: 0, padding: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.desktop}
                    alt={g.alt_desktop}
                    loading="lazy"
                    style={{ flex: "1 1 0", minWidth: 0, width: "100%", height: 190, objectFit: "cover", objectPosition: "top", borderRadius: 6, border: "1px solid #1c2730" }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.phone}
                    alt={g.alt_phone}
                    loading="lazy"
                    style={{ width: 92, height: 190, objectFit: "cover", objectPosition: "top", borderRadius: 12, border: "3px solid #1c2730", flex: "0 0 auto" }}
                  />
                </div>
                <figcaption style={{ ...SMALL, marginTop: 8 }}>{g.caption}</figcaption>
              </figure>
            ))}
          </div>

          <h2 style={H}>{A.cost.heading}</h2>
          <p style={BODY}>
            {A.cost.build_cost_usd === null ? A.cost.build_cost_note : `Build cost: US$${A.cost.build_cost_usd}. ${A.cost.build_cost_note}`}
          </p>
          <p style={BODY}>
            Hosting: US${A.cost.hosting_monthly_usd} a month ({A.cost.hosting_status.toLowerCase()}). {A.cost.hosting_basis}
            {A.cost.hosting_limits ? ` Limits: ${A.cost.hosting_limits}` : " The free tier limits will be stated here from the providers' own pages on the day it goes live."}
            {A.cost.live_url ? "" : " It is not live yet."}
          </p>

          {A.client_words.quote && (
            <>
              <h2 style={H}>{A.client_words.heading}</h2>
              <blockquote style={{ ...BODY, borderLeft: "3px solid var(--gold)", paddingLeft: 16, margin: "0 0 14px" }}>
                {A.client_words.quote}
                {A.client_words.attribution ? <footer style={SMALL}>{A.client_words.attribution}</footer> : null}
              </blockquote>
            </>
          )}

          <h2 style={H}>{A.methodology.heading}</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {A.methodology.rows.map((r) => (
              <div key={r.figure} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 14, fontWeight: 700 }}>{r.figure}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.6 }}>{r.source}</div>
              </div>
            ))}
          </div>
          <p style={{ ...SMALL, marginTop: 14 }}>
            {A.attribution}. Last reviewed {A.last_reviewed}.
          </p>

          <p style={{ ...BODY, textAlign: "center", marginTop: 40 }}>
            Want something like this for your business? A free consultation is the first step, with no pressure.
          </p>
          <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <AnimatedButton href="/audit">Book a free consultation</AnimatedButton>
            <AnimatedButton href="/case-studies" variant="secondary">All case studies</AnimatedButton>
          </div>
        </div>
      </section>
    </main>
  );
}
