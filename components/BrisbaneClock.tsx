"use client";

// A small honest humanizing touch: shows Kyle's actual local time paired
// with the visitor's own (detected from their browser, never stored or
// sent anywhere). Reinforces "one real person in one real timezone" and
// quietly answers "will scheduling actually work" for interstate/overseas
// visitors before they have to ask.

import { useEffect, useState } from "react";

const BRISBANE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Brisbane",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function visitorTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function BrisbaneClock() {
  const [brisbaneTime, setBrisbaneTime] = useState<string | null>(null);
  const [visitorLine, setVisitorLine] = useState<string | null>(null);

  useEffect(() => {
    const tz = visitorTimeZone();
    const update = () => {
      const now = new Date();
      setBrisbaneTime(BRISBANE_FORMATTER.format(now));
      if (tz && tz !== "Australia/Brisbane") {
        try {
          const visitorFormatter = new Intl.DateTimeFormat("en-AU", {
            timeZone: tz,
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          setVisitorLine(`${visitorFormatter.format(now)} where you are`);
        } catch {
          setVisitorLine(null);
        }
      }
    };
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!brisbaneTime) return null;

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
      It&apos;s {brisbaneTime} for Kyle in Brisbane{visitorLine ? ` · ${visitorLine}` : ""} — real
      person, real timezone.
    </p>
  );
}
