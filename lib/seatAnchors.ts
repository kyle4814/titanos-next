// In-page anchors for the portal seats (plan chapter 6, site map lines 1444-1459; C9 residual f262).
// One row per section. No figure appears here that is not already in lib/pricing.ts; anything the plan marks
// EXAMPLE or UNKNOWN is left out and the section says "on request". status "live" = the feature is built and the
// section describes what it does; "coming" = the feature is not built, the section says so and shows no working UI.
export type SeatAnchor = { id: string; title: string; status: "live" | "coming"; body: string; plan: string };
