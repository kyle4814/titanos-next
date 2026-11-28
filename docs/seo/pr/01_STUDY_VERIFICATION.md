# 01. ANZ small-business email security study: verification (2026-11-28)

Status: DRAFT for Kyle. Nothing here has been sent or published. Pitches in 03 must not go out until the L10 gate flips and Kyle approves each one (GATE4).

## What was checked
Published claim: blog /blog/anz-smb-email-security-double-gap-measured (lib/blog.ts line 795, dated 2026-10-01), drawn from 02_anz-smb-email-security-stat-report.md.
Source data: nine per-band scan reports in klinge-kernel/state/research/d89e1778/ocean/deep3/ (Q08, Q30, Q32, Q37, Q43, Q47, Q51, Q55 for Australia; Q44, Q46 NZ; Q49, Q50, Q54 Singapore; Q48 Canada). Method code: klinge-kernel/bin/denylist_match.py (commit 8216744 per the stat report). Recompute script: docs/seo/pr/verify_study.py in this branch.
Note: the raw per-domain tables for Q51 and Q55 are summaries in the report text; per-domain rows exist for Q08 to Q47 only. The domain-level data lives only in the kernel and is never to be published (no domain is named in any public version).

## Result: the headline holds, one published number does not reconcile
| Item | Published | Recomputed from the band reports | Verdict |
|---|---|---|---|
| Eight Australian bands, range | 37.5% to 55.0% | 37.5% (500k-600k) to 55.0% (600k-700k) | CONFIRMED |
| Per-band counts (21/39, 22/43, 21/39, 22/40, 15/40, 16/37, 20/40, 16/40) | as listed | each matches its source report | CONFIRMED |
| Pooled double-gap, Australia | 47.5%, 172 of 362 | 153 of 318 live domains = 48.1% (or 153 of 325 sampled = 47.1%) | DOES NOT RECONCILE: the per-band numerators sum to 153, not 172, and the denominators to 318, not 362 |
| NZ batch 1 | 32.5% (13/40); 54.2% of resolved (13/24) | per Q44 | CONFIRMED against the stat report's own table (Q44 not re-tallied row by row) |
| NZ batch 2 | 61.1% of resolved (11/18) | Q46 line 22: 11 of 36 fresh (30.6%); 61.1% of the 18 resolved | CONFIRMED |
| Singapore 3 batches | 44.0% (40/91), 37.9% (22/58), 41.7% (25/60) | Q49 line 233, Q50 line 25, Q54 line 23 | CONFIRMED |
| Canada | 75.0% DMARC gap (39/52); 26.9% (14/52) double-gap | Q48 (14 of 52 double-gap; 25 of 52 UNKNOWN) | CONFIRMED |

Cause of the mismatch: UNKNOWN. The recompute shows 153 and 318; I could not find where 172 and 362 came from (nothing in the eight reports sums to them). The pooled figure is the only number affected. The conclusion "roughly half, 37.5% to 55%" stands either way, and the corrected pooled rate (48.1%) is within 0.6 points of the published one.

**Action for Kyle (not done here, because the blog file is outside this lane's scope and another workflow is restyling pages):** correct the pooled sentence in lib/blog.ts and the stat report to "153 of 318 live domains (48.1%)" with the sampled-denominator floor "153 of 325 (47.1%)". Until then all pitches use the corrected figure and say "about 48 per cent". A journalist who recomputes from the blog table will otherwise find the error and the credibility cost lands on the next pitch.

Other wording issues found (fix on the blog at the same time):
1. The title says "no DMARC record", but the test counts "no record OR p=none" (monitor-only). Pitches say "no enforced DMARC policy".
2. Q08 itself reports 21 of 40 (52.5%); later reports restate it as 21 of 39 live. The recompute uses 39 (the later, stricter figure). The difference does not move any conclusion.
3. The scan window is 30 September to 1 October 2026 (file dates of the band reports); the blog does not state it. Pitches state it.

## Method, stated honestly (use this paragraph verbatim in any pitch or press release)
Seed population: the Tranco top one million domain ranking (https://tranco-list.eu/), filtered to .com.au, ranks 200,000 to 1,000,000, split into eight bands. The rank band is a cheap proxy for an independent small business, not a census. Brands, franchises, government, media, hosting and registrar domains were stripped with a cumulative denylist (683, then 969, then 1,163 terms) and each sample was read by eye for hijacked, duplicate or casino-affiliate domains. Domains were taken at even spacing from the surviving pool, 37 to 43 live domains per band, 318 in total. Two passive checks per domain: (1) DMARC TXT at _dmarc.<domain> via two public DNS-over-HTTPS resolvers (dns.google and cloudflare-dns.com), counted as a gap if absent or p=none; (2) an HTTPS GET of /.well-known/security.txt (RFC 9116), counted absent only on a real 404 or confirmed catch-all redirect. Timeouts, bot challenges and soft 200s are UNKNOWN and excluded, so every rate is a floor. Nothing was contacted. No domain is named.
Limits: popularity is not a business census; one snapshot, not a trend; evenly spaced, not random, sampling; two disclosed instrument effects (Shopify shared-storefront TLS timeouts in band 500k-600k; a short-token denylist bug fixed mid-run in band 400k-500k); the sample is not split by industry, so no claim about trades or any single sector is supported.

## What the data supports and does not support
Supports: "In a passive sample of 318 small-business .com.au domains, about 48 per cent had no enforced DMARC policy and no security.txt file; band rates ran from 37.5 to 55.0 per cent."
Does not support: any claim about a named sector, any claim that these businesses were or will be attacked, any dollar loss, any claim about all Australian businesses, any trend.

## Sources for context claims (fetched or search-confirmed 2026-11-28 unless marked)
- Tranco ranking: https://tranco-list.eu/ (method paper cited on that page)
- DMARC: RFC 7489 https://www.rfc-editor.org/rfc/rfc7489 (verify, not fetched)
- security.txt: RFC 9116 https://www.rfc-editor.org/rfc/rfc9116 (verify, not fetched)
- ACSC Small Business Cyber Security Guide: https://www.cyber.gov.au/sites/default/files/2023-07/acsc_small_business_cyber_security_guide.pdf (cited in the blog post; not re-fetched)
- ASD Annual Cyber Threat Report 2024 to 2025: https://www.cyber.gov.au/about-us/view-all-content/reports-and-statistics/annual-cyber-threat-report-2024-2025 (cited in the blog post; not re-fetched)
- Our post: https://titanos.tech/blog/anz-smb-email-security-double-gap-measured
