// In-page anchors for the portal seats (plan chapter 6, site map lines 1444-1459; C9 residual f262).
// One row per section. No figure appears here that is not already in lib/pricing.ts; anything the plan marks
// EXAMPLE or UNKNOWN is left out and the section says "on request". status "live" = the feature is built and the
// section describes what it does; "coming" = the feature is not built, the section says so and shows no working UI.
import type { SeatAnchor } from "@/lib/seatAnchors";

export const ANCHORS: SeatAnchor[] = [
  {
    id: "white-label-reports", title: "White-label reports", status: "coming", plan: "D8, plan line 322 (V2, after the soak)",
    body: "Agency reports under your own brand are designed but not switched on. Today a pro sees the scan evidence attached to each job. Pricing and terms are on request when the feature opens.",
  },
  {
    id: "leads", title: "Leads", status: "coming", plan: "D2, plan line 1477 (export-only, country gate)",
    body: "Leads will be export-only: you send from your own inbox, and a per-country rules check runs before every export. It is not built yet, so there is nothing to download today. Terms are on request.",
  },
];
