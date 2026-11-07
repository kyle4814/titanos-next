// In-page anchors for the portal seats (plan chapter 6, site map lines 1444-1459; C9 residual f262).
// One row per section. No figure appears here that is not already in lib/pricing.ts; anything the plan marks
// EXAMPLE or UNKNOWN is left out and the section says "on request". status "live" = the feature is built and the
// section describes what it does; "coming" = the feature is not built, the section says so and shows no working UI.
import type { SeatAnchor } from "@/lib/seatAnchors";

export const ANCHORS: SeatAnchor[] = [
  {
    id: "auto-fix", title: "Reversible auto-fix", status: "live", plan: "C3, plan line 1489",
    body: "Where a fault is a DNS record we can write safely, a quest has a one-tap fix. The exact previous records are stored first, a re-scan checks the result, and one tap puts the old records back. Faults only your provider can see are guided, never guessed.",
  },
];
