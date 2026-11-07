// In-page anchors for the portal seats (plan chapter 6, site map lines 1444-1459; C9 residual f262).
// One row per section. No figure appears here that is not already in lib/pricing.ts; anything the plan marks
// EXAMPLE or UNKNOWN is left out and the section says "on request". status "live" = the feature is built and the
// section describes what it does; "coming" = the feature is not built, the section says so and shows no working UI.
import type { SeatAnchor } from "@/lib/seatAnchors";

export const ANCHORS: SeatAnchor[] = [
  {
    id: "upgrade-dock", title: "Upgrade dock", status: "coming", plan: "plan line 296 (Agent seat)",
    body: "A dock where an agent can see which of its tools have a newer version is designed but not built. Today the catalogue above is the whole surface and each tool lists its own scope and credits per call.",
  },
];
