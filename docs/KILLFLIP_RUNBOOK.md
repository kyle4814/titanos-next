# Obelisk kill-flip runbook

SYNTHETIC / MODELLED. This document was generated from the kill matrix JSON. Nothing in it was executed, nothing is outbound, no Stripe object exists, no deploy happened. Every command below is text for a human or the commander to run after approval.

Matrix head: `deadbeef` (SYNTHETIC fixture sample; the real run reads the live matrix JSON). WOULD-FLIP chunks on this card: C1, C4, C5, C7, C10.

## The one batched card (CORE EXEC9)

| Chunk | Gate(s) | What | Approve |
|---|---|---|---|
| C1 | GATE5 | Deploy the guest scan and the GET THIS FIXED button to titanos.tech, then let the first 1,000 real scans arrive. | approve / deny |
| C4 | GATE2, GATE1, GATE3 | Create live Stripe Connect for pros (platform account, Connect onboarding, payout transfers) and run the first 10 real jobs. | approve / deny |
| C5 | GATE5 | Deploy so 1,000 graded shelves are live, then count ungraded shelves on the live catalogue. | approve / deny |
| C7 | GATE5, GATE2, GATE4 | Deploy the agent door (Worker plus D1), issue 10 test-mode keys, and have 10 EXTERNAL agents each call a tool and get a receipt. | approve / deny |
| C10 | GATE5 | Start the pinned 24 h chaos and load soak on the whole portal. A green board flips the VAL8 gate, which releases all outbound. | approve / deny |

Shared steps: C1, C5 and C7 all start from the same deploy. One deploy approval covers them; keep it as one line on the card.

## C1: Synthetic chunk C1 , label

- Kill test (plan): synthetic kill test - text
- Matrix gate: LIVE TRAFFIC: needs the first 1,000 real scans
- Gate: GATE5 (irreversible)
- Conditional: GATE4 (outbound to a third party / acting as Kyle) only if Kyle or the commander drives the first 1,000 scans through outreach or a post (a third party sees it)

Card text:

- WHAT: Deploy the guest scan and the GET THIS FIXED button to titanos.tech, then let the first 1,000 real scans arrive.
- WHY: The kill test is behavioural: at least 3% of the first 1,000 scans press the button. No code run can supply real visitors.
- COST: AU$0 (static export, existing host). Time: however long 1,000 real scans take.
- REVERSIBLE: The deploy force-pushes the public site (irreversible as an act); the previous build can be redeployed. The counter data stays.

Commands (printed, never run by this script):

1. Kyle approves the deploy card, then the deploy runs (deploy.sh refuses without an approved ref, a clean main and HEAD == origin/main):

```
DEPLOY_APPROVAL_REF=<approved card ref> ./scripts/deploy.sh
```

2. When the live counter reaches 1,000 scans, export the events and tally (no network, no model calls):

```
node scripts/funnel_killtest.mjs events.ndjson
```

Evidence that flips it: funnel_killtest.mjs prints a verdict other than PENDING_LIVE on the first 1,000 scans with presses * 100 >= 3 * 1000. Needs the beacon to send scanId (the code header says so); until then press events cannot be tied to scans.

Already independently verified in code (from the matrix, fresh exit codes):

- matrix status WOULD-FLIP
- primary proof exit 0 in 1.5s: # pass 12
- no independent verifier recorded in the matrix for this chunk

Code proof command:

```
node scripts/test_c1.mjs
```

## C4: Synthetic chunk C4 , label

- Kill test (plan): synthetic kill test - text
- Matrix gate: GATE2 Stripe Connect: real first 10 jobs and live payouts
- Gate: GATE2 (credentials); GATE1 (money / spend); GATE3 (legal commitment)

Card text:

- WHAT: Create live Stripe Connect for pros (platform account, Connect onboarding, payout transfers) and run the first 10 real jobs.
- WHY: The kill test is 100% of the first 10 jobs paid only after re-proof. Code proves the rule against MockPayments; only real jobs prove the rails.
- COST: Stripe fees per payout and per Connect account (confirm the live rate card before approving). Platform float for payouts is a GATE1 amount.
- REVERSIBLE: Accepting Stripe's Connect terms is a legal commitment (GATE3); a paid transfer cannot be recalled by us. Test mode first is fully reversible.

Commands (printed, never run by this script):

CARD NEEDED (Stripe, GATE2, never created by this script):

```
CARD NEEDED: create Stripe Connect platform (test mode first), restricted API key scoped to Connect transfers and account links, webhook endpoint for transfer.* events; route the key to ~/.titanos_env only.
```

Local drill the live run must match (synthetic, in-memory, already green):

```
node scripts/drill_ten_jobs.mjs
```

Evidence that flips it: Ten real jobs in the ledger, each payout transfer id present only for a job with a recorded re-proof, zero transfers for unproven jobs; drill_ten_jobs.mjs shape (PAY10 OK) reproduced from the real ledger.

Already independently verified in code (from the matrix, fresh exit codes):

- matrix status WOULD-FLIP
- primary proof exit 0 in 1.5s: # pass 12
- independent verifier exit 0 in 0.5s
- code INDEPENDENTLY VERIFIED (the live kill test is a separate matter)

Code proof command:

```
node scripts/test_c4.mjs
```

Independent verifier command:

```
node scripts/verify_c4.mjs
```

## C5: Synthetic chunk C5 , label

- Kill test (plan): synthetic kill test - text
- Matrix gate: DEPLOY: 1,000 shelves live needs the site deployed
- Gate: GATE5 (irreversible)

Card text:

- WHAT: Deploy so 1,000 graded shelves are live, then count ungraded shelves on the live catalogue.
- WHY: The kill test is 1,000 shelves live with 0 ungraded. The grader and the scale drill run locally; 'live' needs the site deployed.
- COST: AU$0.
- REVERSIBLE: Same as C1: the deploy is a public force-push; the prior build can be redeployed. Batch with the C1 deploy so one card covers both.

Commands (printed, never run by this script):

1. Deploy (the same single approval as C1):

```
DEPLOY_APPROVAL_REF=<approved card ref> ./scripts/deploy.sh
```

2. Re-run the local scale check against the build that shipped:

```
node --experimental-strip-types --no-warnings scripts/c5_ungraded_verify.mjs 1000
```

Evidence that flips it: 1,000 shelves reachable on the live site and the ungraded count is 0, read from the live catalogue (not the local build).

Already independently verified in code (from the matrix, fresh exit codes):

- matrix status WOULD-FLIP
- primary proof exit 0 in 1.5s: # pass 12
- independent verifier exit 0 in 0.5s
- code INDEPENDENTLY VERIFIED (the live kill test is a separate matter)

Code proof command:

```
node scripts/test_c5.mjs
```

Independent verifier command:

```
node scripts/verify_c5.mjs
```

## C7: Synthetic chunk C7 , label

- Kill test (plan): synthetic kill test - text
- Matrix gate: LIVE TRAFFIC: 10 EXTERNAL agents calling a deployed door
- Gate: GATE5 (irreversible); GATE2 (credentials); GATE4 (outbound to a third party / acting as Kyle)

Card text:

- WHAT: Deploy the agent door (Worker plus D1), issue 10 test-mode keys, and have 10 EXTERNAL agents each call a tool and get a receipt.
- WHY: The kill test is 10 external agents calling a tool and receiving a receipt. The 10 synthetic clients prove the path in-process; external is the point.
- COST: AU$0 in test mode (no live billing). Any live credit charge is a separate GATE1 card.
- REVERSIBLE: Deploy as C1. Test-mode keys can be revoked. Inviting third parties to call the door is GATE4 (acting as Kyle, third parties see it).

Commands (printed, never run by this script):

CARD NEEDED (keys, GATE2, never created by this script):

```
CARD NEEDED: mint 10 test-mode agent keys (scoped, metered, revocable) for the deployed door; route to ~/.titanos_env only.
```

Deploy the Worker and D1 (after the deploy card is approved):

```
DEPLOY_APPROVAL_REF=<approved card ref> ./scripts/deploy.sh
```

Live scorecard, refused unless AGENTS10_LIVE_OK=1 so no stray BASE_URL generates traffic:

```
AGENTS10_LIVE_OK=1 BASE_URL=https://api.titanos.tech SITE_URL=https://titanos.tech AGENT_KEYS=<10 test keys> node --experimental-strip-types portal-api/scripts/agents10.ts
```

Evidence that flips it: A scorecard of 10 distinct external client identities, each with a verified receipt signature and an idempotent replay (same receipt, no second charge), from calls the commander did not make itself.

Already independently verified in code (from the matrix, fresh exit codes):

- matrix status WOULD-FLIP
- primary proof exit 0 in 1.5s: # pass 12
- independent verifier exit 0 in 0.5s
- code INDEPENDENTLY VERIFIED (the live kill test is a separate matter)

Code proof command:

```
node scripts/test_c7.mjs
```

Independent verifier command:

```
node scripts/verify_c7.mjs
```

## C10: Synthetic chunk C10 , label

- Kill test (plan): synthetic kill test - text
- Matrix gate: LIVE TRAFFIC: 24 h chaos and load soak (VAL8 gate flip)
- Gate: GATE5 (irreversible)

Card text:

- WHAT: Start the pinned 24 h chaos and load soak on the whole portal. A green board flips the VAL8 gate, which releases all outbound.
- WHY: The kill test is a green board for 24 h, then the gate flips. The soak runner is localhost-only and tested; the 24 h run is the later GO.
- COST: AU$0 cash. Compute: one machine for 24 h; run on the build whose SHA is recorded as the matrix head.
- REVERSIBLE: The soak itself is reversible (stop it). The VAL8 flip it can trigger is irreversible in effect (outbound opens), so it is the gated step.

Commands (printed, never run by this script):

1. Confirm the build under soak is the matrix head, then start the soak (localhost targets only, the runner refuses anything else):

```
node scripts/soak_harness.mjs --duration 86400 --interval 60 --rps 50 --out state/soak/board.json
```

2. Judge the board and the drift guard (read-only):

```
bash scripts/test_soak_drift_guard.sh
```

Evidence that flips it: The S-board JSON shows every row green for the full 24 h window on the pinned SHA, with the drift guard clean; the VAL8 flip is then Kyle's card, not the script's.

Already independently verified in code (from the matrix, fresh exit codes):

- matrix status WOULD-FLIP
- primary proof exit 0 in 1.5s: # pass 12
- independent verifier exit 0 in 0.5s
- code INDEPENDENTLY VERIFIED (the live kill test is a separate matter)

Code proof command:

```
node scripts/test_c10.mjs
```

Independent verifier command:

```
node scripts/verify_c10.mjs
```
