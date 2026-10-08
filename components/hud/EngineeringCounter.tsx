"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NUM, audAt, engineerYearsAt, AUD_PER_EY, MAX_EXTRAPOLATE_DAYS } from "@/lib/hud/data";

const AUD = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });

export default function EngineeringCounter() {
  // Start on the snapshot so server HTML and first client paint match; then tick.
  const [now, setNow] = useState(NUM.snapshot_ms);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setNow(Date.now());
    if (still) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const ey = engineerYearsAt(now);
  const aud = audAt(now);
  const pace = NUM.rows.engineer_years_per_day_7d.value;
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
      <p className="hud-note">
        This is a model, not revenue and not a bank balance. It starts from the last ledger snapshot ({NUM.snapshot_ts.replace("T", " ")} AEST: {NUM.rows.sloc.value.toLocaleString("en-AU")} lines
        of production code = {NUM.rows.engineer_years.value} engineer-years) and ticks up at the measured 7-day pace of {pace} engineer-years a day, at AU${AUD.format(Math.round(AUD_PER_EY))} per engineer-year.
        Extrapolation stops after {MAX_EXTRAPOLATE_DAYS} days. <Link href="/engineering#method" className="hud-link">MODELLED: COCOMO, method</Link>
      </p>
    </section>
  );
}
