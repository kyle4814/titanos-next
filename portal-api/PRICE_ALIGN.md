# PRICE_ALIGN: site vs plan vs portal (x2_stripe_testmode, 2026-11-07)

Nothing priced was changed. Proposed single source: the business plan ch.5 anchors (01_BUSINESS_PLAN_2026-10-10.md lines 1233-1425) plus CORE NUM1, held in `lib/pricing.ts` on the site and pinned to the portal by `portal-api/test/price_align.test.ts`.
Sources read: SITE = `lib/pricing.ts`, `lib/offers/offers.json` (103 offers) and `lib/offers/data/*.ts` at base `07f6bd3b7`, plus a GET of https://titanos.tech/monitor and /compliance on 2026-11-07 (read only). PLAN = ch.5. PORTAL = `portal-api/src/{catalogue,agent/credits,market/service,enterprise/share}.ts`. AU$, no GST (supplier not registered).

## 1. Side by side

| Item | SITE | PLAN (ch.5, NUM1) | PORTAL | Verdict |
|---|---|---|---|---|
| Free scan | 0 | free | n/a (not a checkout product) | agree |
| Compliance Monitor monthly | 149 (`MONITOR_MONTHLY`); deployed /monitor shows AU$149 (31 mentions) and AU$1,490 annual | 149 (archived pages said 199; plan 5.11 lists this as UNKNOWN) | 14,900 c | **agree; plan UNKNOWN is now resolved by observation: AU$149** |
| Monitor annual | 1,490 | not in plan | 149,000 c | portal = site; plan silent. Add to plan. |
| Privacy Act + Essential Eight pack | 5,997 one-off, includes 3 free monitor months then opt-in | 5,997 | 599,700 c | agree. Plan's "AU$199/mo monitoring" with the pack is the archived page and is stale. |
| Retainers | 1,500 / 2,500 / 5,000 per month, 3-month minimum | 1,500 / 2,500 / 5,000, 3-month min | 150,000 / 250,000 / 500,000 c, minMonths 3 | agree |
| Leads Starter / Growth / Campaign | 497 / 1,497 / 3,497 | "AU$497 to 3,497" | 49,700 / 149,700 / 349,700 c | agree |
| Leads Retainer | 990 per month | not listed | 99,000 c | **conflict: in site and portal, absent from plan** |
| Job Flow (tradie entry) | 249 per month in `lib/pricing.ts`, page held | AU$249/mo "IN CONFIG, page held" (P009) | not in catalogue | agree, unbuilt |
| Enterprise listed | 49,997 / 74,997 / 99,997 / 149,997 (OEM) as annual-style anchors, plus SOC 24,997/mo, monitoring 14,997/mo, board advisory 7,997/mo | 49,997 to 149,997 a year | no priced enterprise product (rates are EXAMPLE in `enterprise/share.ts`) | **conflict: site has three monthly enterprise anchors the plan never lists; the plan calls the band annual** |
| Nuke offer | not on the site | 4,997 / 6,500 / 6,500 = 17,997, or Gate 1 + 20% of savings | none | **conflict: plan 5.2 cites archived "AI Implementation from AU$4,997" as a live site price; the site is retainer-only since 2026-07-16 and has no 4,997 anywhere in `app/` or `lib/`** |
| Owner tiers (D7) | none | FREE / 49 / 149 / 499 a month (EXAMPLE) | none (no tier products in `catalogue.ts`) | gap: nothing to bill yet. 49 and 499 appear nowhere in the portal. |
| Pro seat | "claim fee AU$29 to ..." in /pro | AU$149/mo (EXAMPLE) | seat billing "NOT wired" (`market/service.ts:43`), fee factor 0.5 | gap: seat price exists only as copy |
| Marketplace claim fee | AU$29 to 149 band in /pro copy | AU$29 to 149 by size (EXAMPLE) | small 2,900 / standard 5,900 / large 14,900 c claim fee; job pay 9,900 / 24,900 / 59,900 c | agree on band. Job pay prices 99 / 249 / 599 are portal-only EXAMPLEs; plan says average job value UNKNOWN. |
| Metered credits | "1 credit = AU$0.01 (example rate)" on `app/agents/page.tsx` | **no number set** (5.8); examples are in US$ (Mothership US$0.005 a call) | packs 2,000 / 10,000 / 50,000 credits = AU$20 / 100 / 500 | **conflict: portal fixes an AU$ rate and three packs where the plan says UNKNOWN and shows US$ examples** |
| Partner share | n/a | 30% recurring, 40% at 5+, 50% at 20+ | `RATE_V1` baseBps 3000, `tiers: []` | **conflict: tiers 40% and 50% not wired** |
| Offers catalogue (103) | 30 READY, 48 CHECK, 24 BUILD, 1 KEY; READY prices 0 to 5,997 (20 distinct values); 29 have a Stripe link | not enumerated | not in catalogue | gap: 29 priced offers buyable via payment links, none through the portal. Some reuse plan numbers with different meaning (AU$49 and AU$199 are rival, report and tradie prices, not owner or monitor tiers). |

Stale or rival monitor figures inside offers: `multipliers-a.ts:75` says the retail Monitor is AU$149 (agrees). AU$199 appears in `specialist.ts:420`, `enterprise.ts:669`, `sales-selfserve.ts:195` as different products (trigger feed, quarterly series, per-target report), not the monitor. Not a conflict, but a reader searching "199" will find them; the plan's AU$199 monitor figure is only the archived static pages.

## 2. Conflicts to settle (proposed resolution, nothing applied)

1. **Monitor price: AU$149 (resolved).** Deployed site, `lib/pricing.ts` and portal all say 149 / 1,490. Plan 5.2 and 5.11 should drop AU$199 and the UNKNOWN. Plan edit, not a code edit.
2. **Nuke / "AI Implementation from AU$4,997".** Plan cites a page that no longer exists. Proposal: plan keeps 4,997 / 6,500 / 6,500 as a DEFINED nuke price (not a site price); site stays retainer-only.
3. **Enterprise shape.** Plan says 49,997 to 149,997 a year; site lists three monthly enterprise anchors on top. Owner decision: keep monthly anchors in the plan or remove from `lib/pricing.ts`.
4. **Leads retainer AU$990/mo.** Add to the plan's leads row (site and portal already agree).
5. **Credits.** Portal's AU$0.01 per credit and 20 / 100 / 500 packs are EXAMPLE; plan says no rate. Owner sets the rate (GATE1) before any pack is created in Stripe.
6. **Partner tiers 40% / 50%** unwired in `RATE_V1`; wire when partner terms are signed off (Gate 3).
7. **Owner tiers 49 / 149 / 499 and Pro seat 149** have no catalogue product. Add rows to `catalogue.ts` only once D7 figures leave EXAMPLE. The monitor 149 row already doubles as the "weekly monitor" tier.

## 3. What is pinned today

`portal-api/test/price_align.test.ts` (3 tests, green): the 10 portal products equal `lib/pricing.ts` x 100 and the retainer minimum term equals the site's. `catalogue.ts` line 2 names `scripts/test_portal_catalogue.mjs` as its pin; that file does not exist at this base or in git history, so this test is the first real pin. The Stripe harness (`scripts/stripe_testmode.ts`) additionally asserts each Stripe test price created equals the catalogue amount.
