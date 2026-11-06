import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Block } from "@/components/SiteBlocks";
import status from "../../public/data/status.json";

// Data file: public/data/status.json, built by scripts/gen_status.mjs. UNKNOWN is never shown as UP; no samples renders "no data yet".
const META_TITLE = "Status: what is up, what is down, what we do not know | TITANOS";
const META_DESC = "Per-component state with the window, the number of checks and when it was last checked. Unknown stays unknown.";

export const metadata: Metadata = withSeo("/status", {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/status" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/status" },
  // noindex while the data is a synthetic sample (scripts/test_status.mjs fails if this flips with synthetic data); flip when real monitor output lands.
  robots: { index: false, follow: true },
});

type Comp = { id: string; name: string; measures: string; state: string; stale: boolean; lastKnown: string | null; window: string; up: number; total: number; pct: number | null; lastChecked: string | null; note: string };

const hasData = (c: Comp) => c.total > 0 && c.pct !== null;
const sourceLabel = status.synthetic ? "synthetic sample" : "monitor output";
const fmt = (iso: string) => new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", dateStyle: "medium", timeStyle: "short" });

export default function Status() {
  const comps = status.components as Comp[];
  return (
    <>
      <PageHero badge="STATUS" title="What is up, and what we do not know." tagline="Each component shows its state, the window, how many checks sit behind it and when it was last checked." />
      {status.synthetic && (
        <Block point="Sample data">
          <p data-status-synthetic="true">SYNTHETIC SAMPLE. The rows below are invented to show the format. They are not measurements of TITANOS. No uptime figure is claimed.</p>
        </Block>
      )}
      {comps.map((c) => (
        <Block key={c.id} point={c.name}>
          <p data-status-state={c.state} data-status-component={c.id}>
            <strong>{c.state}</strong>
            {c.stale ? <> <strong data-status-stale="true">STALE</strong></> : null}
            {c.lastKnown ? <> (last known {c.lastKnown})</> : null}
          </p>
          <p>{c.measures}</p>
          {hasData(c) ? (
            <p>{c.window}: {c.up} of {c.total} checks passed ({c.pct}%). Source: {sourceLabel}. Last checked {c.lastChecked ? fmt(c.lastChecked) : ""}.</p>
          ) : (
            <p data-status-nodata="true">no data yet</p>
          )}
          {c.note && hasData(c) ? <p style={{ color: "var(--dim)" }}>{c.note}</p> : null}
        </Block>
      ))}
      <Block point="Where this page comes from">
        <p data-provenance="/status">{status.system}. Page data built {fmt(status.generatedAt)}; a component whose last check is more than a day old is flagged STALE and is not shown as UP. Data file: <a href="/data/status.json" style={{ color: "var(--gold)" }}>/data/status.json</a>.</p>
        <p>{status.monitorInput.present ? "Monitor output was merged into this build." : "No monitor output was available when this was built, so nothing here is a live reading."}</p>
      </Block>
    </>
  );
}
