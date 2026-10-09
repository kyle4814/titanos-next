"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NUM, AUD_PER_EY, FALLBACK_MAX_DAYS, engineerYearsAt } from "@/lib/hud/data";
import { REFRESH_MS, validateNumbers, reanchor, eyAt, pulse, type Anchor, type LiveNumbers } from "@/lib/hud/live.mjs";

const AUD = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });

export default function EngineeringCounter() {
  // First paint = the build snapshot (server HTML and first client paint match). Then /hud/numbers.json takes over.
  const [now, setNow] = useState(NUM.snapshot_ms);
  const [live, setLive] = useState<LiveNumbers | null>(null);
  const anchor = useRef<Anchor | null>(null);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setNow(Date.now());
    const tick = still ? 0 : window.setInterval(() => setNow(Date.now()), 100);
    const pull = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/hud/numbers.json?ts=${Date.now()}`, { cache: "no-store" });
        const m = r.ok ? validateNumbers(await r.json()) : null;
        if (!m) return;
        const t = Date.now();
        const shown = anchor.current ? eyAt(anchor.current, t) : 0;
        anchor.current = reanchor(shown, m, t); // never backwards: max(shown, measured)
        setLive(m);
        setNow(t);
      } catch {}
    };
    pull();
    const poll = window.setInterval(pull, REFRESH_MS);
    return () => { if (tick) clearInterval(tick); clearInterval(poll); };
  }, []);
  const a = anchor.current;
  const ey = a ? eyAt(a, now) : engineerYearsAt(now);
  const aud = ey * (a ? a.aud_per_ey : AUD_PER_EY);
  const p = live ? pulse(live, now) : null;
  const pace = live ? live.ey_per_day_1h : NUM.rows.engineer_years_per_day_7d.value;
  return (
    <section className="hud-panel hud-hero" aria-label="Live engineering counter">
      <div className="hud-label">Live engineering counter <span className="hud-tag">MODELLED</span></div>
      <div className="hud-bigrow">
        <div>
          <div className="hud-big" aria-live="off" data-testid="hud-ey">{ey.toFixed(5)}</div>
          <div className="hud-unit">engineer-years built</div>
        </div>
        <div>
          <div className="hud-big hud-big-gold" aria-live="off" data-testid="hud-aud">AU${AUD.format(Math.round(aud))}</div>
          <div className="hud-unit">replacement value, what a conventional team would charge</div>
        </div>
      </div>
      <div className="hud-note" data-testid="hud-pulse" aria-live="off">
        {p ? (
          <>
            <strong>Fleet pulse</strong> <span className="hud-tag">MEASURED</span> {p.jobs1h} jobs done this hour (7-day average {p.jobsAvg} an hour). Build pace now{" "}
            <span className="hud-tag">MODELLED</span> {p.paceNow.toFixed(2)} engineer-years a day against {p.pace7d.toFixed(2)} over 7 days
            {p.ratio === null ? "" : ` (${p.ratio.toFixed(2)}x)`}.
            {p.stale ? ` Last measurement is ${p.ageMin} minutes old, so the counter is holding.` : ` Measured ${p.ageMin} min ago.`}
          </>
        ) : (
          <>Waiting for the first live measurement. Showing the build snapshot.</>
        )}
      </div>
      <p className="hud-note">
        This is a model, not revenue and not a bank balance. {live ? <>Every minute it re-anchors to the latest measurement ({live.sloc.toLocaleString("en-AU")} lines
        of production code across {live.repos} repos = {live.ey.toFixed(1)} engineer-years, counted from committed code) and never goes backwards.
        Between measurements it ticks at the live 1-hour build pace ({pace.toFixed(2)} engineer-years a day), so it speeds up when the fleet is busy and slows when it is quiet, and it
        cannot run more than two minutes ahead of the last measurement.</> : <>Until the live feed answers it starts from the last ledger snapshot ({NUM.snapshot_ts.replace("T", " ")} AEST:{" "}
        {NUM.rows.sloc.value.toLocaleString("en-AU")} lines of production code = {NUM.rows.engineer_years.value} engineer-years) and ticks at the measured 7-day pace of {pace} engineer-years a day
        for at most {FALLBACK_MAX_DAYS} days.</>} AU${AUD.format(Math.round(live ? live.aud_per_ey : AUD_PER_EY))} per engineer-year.{" "}
        <Link href="/engineering#method" className="hud-link">MODELLED: COCOMO, method</Link>
      </p>
    </section>
  );
}
