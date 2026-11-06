# wA_accept: independent acceptance probes (2026-11-06)

Author: wA_accept (built none of C1 to C9). Branch web/wA_accept-2026-11-06 off web/obelisk-int-2026-11-06 (2434cd7ed). Files here are NOT in the npm test chain and change no product code.

Run from `portal-api/` (node 22): `node --experimental-strip-types acceptance/wA/<file>`. After `npm run build` in the repo root: trace.mjs, lint_all.mjs, lint_one.mjs read `out/`.

| file | what | expected result on 2434cd7ed |
|---|---|---|
| p1.ts | cross-tenant owner reads, domain squat, payout rules, funding abuse, internal secret | BREACH on FUND-unpaid-session (C4 repro). PAY-owner-self-fix and RANK-wash-trade are design observations. INT-padded is a harness artefact (Headers trims spaces) |
| p2.ts | concurrent rescan + sweep gives exactly one transfer | transfers 1 |
| p3.ts, p3b.ts | agent door: scopes, receipts, rate and credit races, BYOK leak, idempotency | held except unvalidated scope strings and idempotency replay across different args |
| p4.ts | auth token race, refund/cancel IDOR and races, webhook duplicates, export, delete | all held |
| p5.ts | C3 auto-fix on SPF redirect=, 11 lookups | auto-fix writes redirect= plus -all and declares PROVEN (C3 repro) |
| p6.ts | C1 scanner on SPF cases the 21 planted fixtures do not cover | v=spf10, ptr, junk tokens and 12 includes all grade PASS |
| p7.mjs | C5 grader mutations | non-finite and string prices show |
| p8.mjs, q.tsv | C6 independent 69-question set | 58/69 top-1 |
| p9.ts | C1 runtime network spy | only cloudflare-dns.com |
| soak.ts | C10 partial soak: `node --experimental-strip-types acceptance/wA/soak.ts <seconds> <seed>` | 0 leaks, 0 exceptions, paidFromUnpaidFunding > 0 |
| trace.mjs, lint_all.mjs, lint_one.mjs | C9 number tracing and content_lint --figures on built pages | /investors ladder fails |
