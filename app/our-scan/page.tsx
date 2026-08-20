"use client";

import { useEffect } from "react";
import { SystemLabel } from "@/components/Myth";

// /our-scan merged into /scan#self-scan (consolidated 2026-07-05). Static
// export (output: "export" in next.config.ts) has no server at request
// time, so next.config redirects() would be silently ignored here — same
// limitation already documented for headers() at the top of
// next.config.ts. A client-side replace is the static-export equivalent
// of a 301 for a fully static host (GitHub Pages).

const DEST = "/scan#self-scan";

export default function OurScanRedirect() {
  useEffect(() => {
    window.location.replace(DEST);
  }, []);

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${DEST}`} />
      <div style={{ padding: "80px 20px", textAlign: "center" }}>
        <SystemLabel style={{ marginBottom: 12 }}>Route consolidated · 2026-07-05</SystemLabel>
        <p style={{ color: "var(--text)", fontSize: "var(--fs-body)" }}>
          This page has moved. <a href={DEST} style={{ color: "var(--gold)" }}>Continue to the self-scan section →</a>
        </p>
      </div>
    </>
  );
}
