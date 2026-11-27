"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NUM, engineerYearsAt, MAX_EXTRAPOLATE_DAYS } from "@/lib/hud/data";

export default function EngineeringCounter() {
  // Start on the snapshot so server HTML and first client paint match; then tick.
  const [now, setNow] = useState(NUM.ledger_as_of_ms);
  useEffect(() => {
    setNow(Date.now()); // one read: the figure holds after MAX_EXTRAPOLATE_DAYS, so there is nothing left to tick
  }, []);
  const ey = engineerYearsAt(now);
  const pace = NUM.rows.engineer_years_per_day_7d.value;
  const asOf = NUM.ledger_as_of.replace("T", " ");
  return (
    <section className="hud-panel hud-hero" aria-label="Engineering counter">
      <div className="hud-label">Engineering counter <span className="hud-tag">MODELLED</span></div>
      <div className="hud-bigrow">
        <div>
          <div className="hud-big" aria-live="off" data-testid="hud-ey">{ey.toFixed(2)}</div>
          <div className="hud-unit">engineer-years, modelled, as of {asOf.slice(0, 10)}</div>
        </div>
      </div>
      <p className="hud-note">
        This is a size model, not revenue, not a bank balance and not a dollar value. It is taken from the last ledger snapshot ({asOf} AEST: {NUM.rows.sloc.value.toLocaleString("en-AU")} lines
        of production code = {NUM.rows.engineer_years.value} engineer-years by Basic COCOMO). From that date it adds the measured 7-day pace of {pace} engineer-years a day for at most {MAX_EXTRAPOLATE_DAYS} days, then holds. It has not been re-measured since. <Link href="/engineering#method" className="hud-link">MODELLED: COCOMO, method</Link>
      </p>
    </section>
  );
}
