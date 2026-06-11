"use client";

/**
 * DeadlineCounter — live "X days remaining" pill until 11 Dec 2026
 * Brisbane midnight.
 *
 * Refresh strategy:
 *   - Recalculate on mount
 *   - Recalculate every 60s (catches midnight rollover within 1 minute)
 *   - Recalculate on document `visibilitychange` → visible (user
 *     returns to tab after sleep / app-switch)
 *   - Recalculate on window `focus` (returns from another window)
 *   - Also schedules a precise timer that fires at the next exact
 *     day-rollover so the count drops within ~100ms of the boundary
 *     even if the 60s tick hasn't fired yet
 */

import { useEffect, useState } from "react";

const TARGET = new Date("2026-12-11T00:00:00+10:00").getTime();
const DAY_MS = 86_400_000;

function calc(): number {
  const now = Date.now();
  return Math.max(0, Math.ceil((TARGET - now) / DAY_MS));
}

// Milliseconds until the next time `calc()` will drop by 1.
function msToNextRollover(now: number): number {
  const remaining = TARGET - now;
  if (remaining <= 0) return Number.POSITIVE_INFINITY;
  const currentDays = Math.ceil(remaining / DAY_MS);
  const nextDropAt = (currentDays - 1) * DAY_MS;
  return Math.max(500, remaining - nextDropAt + 50);
}

export default function DeadlineCounter() {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setDays(calc());
    update();

    // 60s heartbeat — catches drift + screen-on after long sleep.
    const heartbeat = window.setInterval(update, 60_000);

    // Precise next-rollover timer. Reschedules itself.
    let rolloverTimer = 0;
    const scheduleRollover = () => {
      const delay = msToNextRollover(Date.now());
      if (!Number.isFinite(delay)) return;
      rolloverTimer = window.setTimeout(() => {
        update();
        scheduleRollover();
      }, delay);
    };
    scheduleRollover();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        update();
        window.clearTimeout(rolloverTimer);
        scheduleRollover();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", update);

    return () => {
      window.clearInterval(heartbeat);
      window.clearTimeout(rolloverTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", update);
    };
  }, []);

  return (
    <span
      className="deadline-pill"
      style={{
        display: "inline-block",
        marginLeft: 10,
        padding: "3px 10px",
        background: "rgb(var(--gold-rgb) / 0.08)",
        border: "1px solid var(--gold-dim)",
        color: "var(--gold)",
        fontFamily: "var(--font-display), Georgia, serif",
        fontSize: "var(--fs-sm)" /* AES-09: Cinzel ≥0.85rem (was 0.78rem) */,
        letterSpacing: "0.06em",
        borderRadius: "var(--radius-lg)",
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
      aria-live="polite"
    >
      {days === null ? "—" : `${days} days`}
      <span style={{ marginLeft: 4 }}>remaining</span>
      <style>{`
        @media (max-width: 480px) {
          .deadline-pill { font-size: var(--fs-xs); padding: 2px 8px; margin-left: 6px; }
        }
      `}</style>
    </span>
  );
}
