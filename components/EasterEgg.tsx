"use client";

/**
 * EasterEgg — W4 Pillar 7 #8.
 *
 * console.log greeting for buyers who pop devtools open to check the
 * site for fakeness. Quiet craft signal — if they're looking under the
 * hood they're already evaluating.
 */

import { useEffect } from "react";

export default function EasterEgg() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const styles = [
      "color:#D4AF37",
      "font-family:Georgia, serif",
      "font-size:14px",
      "font-style:italic",
      "letter-spacing:0.04em",
    ].join(";");

    /* eslint-disable no-console */
    console.log("%cTITANOS", styles + ";font-size:32px;font-weight:bold");
    console.log(
      "%cLooking under the hood? kyle@titanos.tech if you'd like to talk.",
      styles
    );
    console.log(
      "%cABN 34 318 502 254 · https://abr.business.gov.au/ABN/View?id=34318502254",
      "color:#888;font-family:ui-monospace, monospace;font-size:11px"
    );
    console.log(
      "%cBuilt by Kyle Deligny with Claude Code, Anthropic's agentic coding tool. 1,700+ automated corpus scans this month.",
      "color:#888;font-family:ui-monospace, monospace;font-size:11px"
    );
    /* eslint-enable no-console */
  }, []);

  return null;
}
