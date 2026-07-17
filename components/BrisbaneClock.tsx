"use client";

// A small honest humanizing touch: shows Kyle's actual local time next to
// the booking widget. Reinforces "one real person in one real timezone,"
// not an agency or a bot. No animation beyond the digits ticking over.

import { useEffect, useState } from "react";

const FORMATTER = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Brisbane",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export default function BrisbaneClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setTime(FORMATTER.format(new Date()));
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <p
      style={{
        textAlign: "center",
        color: "var(--dim)",
        fontSize: "var(--fs-xs)",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        letterSpacing: "0.04em",
        margin: "0 0 14px",
      }}
    >
      It&apos;s {time} for Kyle right now in Brisbane — real person, real timezone.
    </p>
  );
}
