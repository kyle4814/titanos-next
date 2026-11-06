# x3_escape_review: independent security probes (2026-11-07)

Author: x3_escape_review (built none of the portal). Target: `web/obelisk-int2-2026-11-07` at 8e31b8a3a (the newest obelisk-int branch pushed; `l10/int-2026-11-07` from m01_merge was not pushed when this ran). Files here are NOT in the `npm test` chain and change no product code.

Run from `portal-api/` (node 22, no network, no keys, synthetic data only): `sh acceptance/x3/run.sh`

Convention: a `BLOCKED` test passes while the attack fails (regression guard). A `FINDING` test passes while the hole is OPEN and prints an `X3-FINDING <id> <sev> ...` line; when a finding is fixed its test fails, and flipping its assertion is the regression test for the fix.

| file | covers |
|---|---|
| a_auth_webhook.test.ts | bearer forms, login-link lifecycle, 14-way webhook forgery matrix, credit-order forgery, internal-secret door, login throttle abuse, prototype-named ids, lost-event, session revocation |
| b_tenancy.test.ts | 18 cross-account attacks over C2/owner/market/agent + 9 read surfaces with canaries and a before/after state diff; SSO cross-tenant, replay, alg, nonce, admin mint; partner consent; SSO-enforcement gap; issuer; RBAC and CSV formulas |
| c_money.test.ts | payout without proof, funding forgery, self-claim, orphaned money, chargebacks, seat discount, minimum term, wash trade, domain masking, scan amplification |
| d_agent.test.ts | key scope, tk/ss confusion, prompt injection into explain_finding, receipt forgery, the BYOK sentinel, prototype-named arguments |
| e_ssrf_injection.test.ts | 35 hostile domain strings, network spy on scan/rescan/DoH, API intake, concierge injection and ReDoS, header and recipient injection |
| f_races.test.ts | claim, payout, login-token, webhook, credit and refund races |

Mutation check (the BLOCKED probes can fail): 5 product mutants each killed (webhook signature off, payout proof guard off, tenant membership check off, invoice ownership check off, MCP scope check off). The first run of the payout mutant SURVIVED the route-level probe (the guard is not reachable from any route); a direct `releasePayout` probe was added and kills it.
