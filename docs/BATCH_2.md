# BATCH 2 — scaffolded specs, not yet built

Logged 2026-06-11 alongside `conversion-fixes-v1` PR. Each item below
is a single spec, not implementation. Build in a follow-up PR once
BATCH 1 has shipped and conversion data is in.

## 1. "Am I in scope?" 5-question interactive checker (`/compliance`)

A small client-side flow under the FOUR DEADLINES section that asks
five yes/no questions covering the buyer's exposure surface:
(a) AU registered business (Y/N), (b) any customer-record handling
including marketing lists (Y/N), (c) any automated decision-making
including AI tools in service workflow (Y/N), (d) any use of personal
data in pricing / targeting / hiring / claims (Y/N), (e) staff count
≥1. Result classifies into "in scope today", "in scope post-tranche-2",
or "not in scope (here's why)" and email-gates the explainer paragraph
so the answer also captures the lead. State lives in `sessionStorage`
so a refresh doesn't reset; results trigger `data-analytics="scope-checker-{result}"`.
No fabricated thresholds — every classification line cites the
specific legal source (Privacy Act 1988 s.6D, OAIC small-business
exemption guidance, Tranche 2 explanatory memorandum).

## 2. Full redacted sample scan report page (`/sample-report`)

Extend the `TerminalSnippet` from a 6-line teaser into a full HTML
mirror of the actual report a customer receives — every section,
every header, every CVE row, redacted domain throughout. Lives at
`/sample-report`. Cross-linked from `/scan` ("See a complete sample
report →") and `/our-evidence-pack` ("Same report shape, applied to
my own infrastructure"). Built by piping a real
`vuln_scanner` JSON through the existing report renderer and
substituting `[redacted].com.au` for the target. Verify no real
customer data slips through before publishing.

## 3. Testimonial collection flow

Post-engagement email template + intake form pair. The email fires
14 days after the 30-day review call (giving the customer time to
see the value), asks for a one-paragraph quote and explicit
publication consent. Intake form on `/share-your-experience`
(unlinked from nav, only sent by email) captures quote + name + role
+ company + offer + consent flag, writes to a draft file in
`lib/testimonials.ts`. Kyle reviews + commits. The `<Testimonials />`
render block already short-circuits empty arrays so partial fills are
safe. Bake the "yes, publish under my name" checkbox as the only path
to submission — no consent, no submission, no quiet capture.

## 4. Analytics wiring for the `data-analytics` hooks

Every form/button/section that matters carries a `data-analytics="…"`
attribute already. Wire a single lightweight script (no Google
Analytics, no third-party SDK) that listens for `click` + `submit`
on `[data-analytics]`, batches to a `/track` endpoint on
api.titanos.tech, and stores `{ts, event, path, referer, viewport,
prefers_reduced_motion}` in a JSONL on disk. Privacy stance: no
cookies, no IP storage beyond the daily aggregate counter, no
cross-site tracking. Surface a weekly digest email to Kyle of
top-clicked CTAs by page. Keep the script ≤4KB and load it with
`defer`. The hooks listed below should fire:

- `scan-form` (form mount)
- `scan-form-submit` (button click)
- `scan-form-success` (post-202 message render)
- `scan-form-error` (error state render)
- `scan-form-mailto-fallback` (error-state mailto click)
- `slot-scarcity` (block visible)
- `operator-byline` (block visible)
- `testimonials` (section visible once entries land)
