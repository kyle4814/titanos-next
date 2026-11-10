// In-page anchors for the portal seats (plan chapter 6, site map lines 1444-1459; C9 residual f262).
// One row per section. No figure appears here that is not already in lib/pricing.ts; anything the plan marks
// EXAMPLE or UNKNOWN is left out and the section says "on request". status "live" = the feature is built and the
// section describes what it does; "coming" = the feature is not built, the section says so and shows no working UI.
import type { SeatAnchor } from "@/lib/seatAnchors";

export const ANCHORS: SeatAnchor[] = [
  {
    id: "upgrade-dock", title: "Upgrade dock", status: "live", plan: "plan line 296 (Agent seat)",
    body: "The dock reads your plan, your credits left, your own spend cap, the calls you made recently and your key scopes, then lists the upgrades that fit, most pressing first. Each option says whether you can undo it. Every price comes from the same table as the pricing page. It only lists options: nothing is bought or changed from here. The example below uses made-up numbers until your key is live.",
  },
];
