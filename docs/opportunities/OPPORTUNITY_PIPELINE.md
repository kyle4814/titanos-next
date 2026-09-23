# TITANOS Opportunity Pipeline

Canonical index for grants, programs, partnerships, accelerators, procurement opportunities and other externally sourced capital/distribution opportunities.

## Record schema

| Field | Meaning |
|---|---|
| ID | Stable identifier |
| Opportunity | Exact program name |
| Type | Grant / accelerator / partnership / procurement / investment |
| Source | Canonical URL |
| Amount | Published amount/range, if any |
| Eligibility | Exact evidence + jurisdiction |
| Deadline | Source date + timezone where relevant |
| Fit | Why TitanOS appears to fit; mark uncertain claims |
| Evidence | Source document / page / repo artifact |
| Verified | Date last checked |
| Status | NEW / VERIFY / READY / SUBMITTED / CLOSED |
| Next action | Smallest concrete next step |
| Human gate | Submission, commitment, legal/financial decision, etc. |

## Current opportunity

### NGI Zero / NLnet — SpoofGuard
- **ID:** OPP-001
- **Type:** Grant
- **Status:** VERIFY
- **Project:** SpoofGuard — free, self-hostable email-spoofing checker
- **Reported amount:** €5,000–€50,000
- **Reported deadline:** 3 November 2026
- **Canonical source:** https://nlnet.nl/propose/
- **Evidence:** user-supplied opportunity message/screenshots; **must be re-verified against NLnet before submission**
- **Fit hypothesis:** open-source security tooling appears directionally aligned with the stated program scope; exact fund eligibility and call terms remain to be verified.
- **Next action:** verify current call page, fund name, eligibility, deadline, budget rules and submission fields; then reconcile the draft application against verified facts.
- **Human gate:** final submission.

## Operating rule

No opportunity enters READY merely because a message says it is a fit. READY requires current primary-source verification. Store the evidence and the date so stale opportunities cannot silently remain active.
