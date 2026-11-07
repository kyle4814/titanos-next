// In-page anchors for the portal seats (plan chapter 6, site map lines 1444-1459; C9 residual f262).
// One row per section. No figure appears here that is not already in lib/pricing.ts; anything the plan marks
// EXAMPLE or UNKNOWN is left out and the section says "on request". status "live" = the feature is built and the
// section describes what it does; "coming" = the feature is not built, the section says so and shows no working UI.
import type { SeatAnchor } from "@/lib/seatAnchors";

export const ANCHORS: SeatAnchor[] = [
  {
    id: "estate", title: "Estate view", status: "coming", plan: "C8, plan line 1496",
    body: "One view over every domain a group owns is designed but not built. Tenant isolation has to be tested adversarially before it opens. Until then an estate is scoped on a call.",
  },
  {
    id: "dossiers", title: "Dossiers", status: "coming", plan: "plan line 297 (Enterprise seat)",
    body: "A sourced dossier on your organisation, built from public records only, is part of a scoped engagement. There is no self-serve dossier yet. Details are on request.",
  },
  {
    id: "nukes", title: "Nukes", status: "coming", plan: "plan line 297 (Enterprise seat)",
    body: "A nuke is our name for the large evidence pack built for a single organisation, with the savings worked out from your own figures. It is agreed on a call, with the price set before anything starts. The price is on request.",
  },
  {
    id: "savings-calculator", title: "Savings calculator", status: "coming", plan: "plan line 297; register P096 (SPEC)",
    body: "A calculator that runs on your numbers is specified but not built, and no savings figure is published here. We work it out with you on a call and show the method.",
  },
  {
    id: "sso", title: "SSO", status: "live", plan: "C8, plan line 1496",
    body: "Single sign-on over OpenID Connect is built and tested against generated keys. The setup steps are below. No live identity provider is connected yet, and connecting yours is arranged on a call.",
  },
];
