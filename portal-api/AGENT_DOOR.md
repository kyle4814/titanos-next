# Agent door (C7)

Code: `src/agent/` (tools, mcp, credits, receipt, files). Tests: `test/agent.test.ts`. Migration 0003 (written, NOT applied, GATE5).

- `POST /mcp`: MCP over HTTP, JSON-RPC 2.0, `Authorization: Bearer tk_...`. Methods: initialize, ping, tools/list, tools/call.
- Scopes: catalogue:read, scan:read, account:read, credits:read, explain:model, receipt:verify. A key sees and calls only its scopes.
- Billing: 1 credit = AU$0.01 (EXAMPLE rate). Prepaid debit before the run, reversal on failure. `explain_finding` is the only model-backed tool: caller key in `x-model-key` (BYOK, never stored) costs 0, otherwise 25 credits.
- Receipts: HMAC-SHA256 over id|tool|key|account|at|inputSha|outputSha|credits|mode with the receipt keyring (Deps `receiptSecrets` {kid: secret} + `receiptKid` current; the single `receiptSecret` is kid k1; nothing configured = every call refused). Each receipt carries its `kid`, bound into the signature; old receipts verify under their old kid until that kid is removed from the ring (then they fail closed). Rotation = add k2, set receiptKid=k2, keep k1 as long as old receipts must verify.
- Per-key spend caps (F19): `capDaily` (UTC day) and `capTotal` in credits, defaults 500 / 2000 (EXAMPLE, AU$5 / AU$20), max 100000 / 1000000; a cap of N allows spend up to and including N. Enforced inside `Store.creditDebitCapped` with the balance check and ledger write as ONE atomic step (D1 adapter: one conditional UPDATE/transaction, NOT BUILT). Failed-call reversals give the cap back. Only an owner session can create keys with caps or `PATCH /keys/:id`; an agent key cannot change caps.
- Key prefix (F19): `tk_` + 8 hex of the secret, stored beside the hash, shown in `GET /keys`, `GET /keys?prefix=tk_xxxxxxxx` (owner-scoped) and `traceKeyPrefix` (operator, service level, no route until admin auth exists).
- Public: `GET /agent/tools`, `GET /.well-known/agent.json`, `POST /agent/receipts/verify`.
- Account: `GET /agent/credits`, `POST /agent/credits/topup {pack}` (mock checkout; webhook grants credits).
- Site copies are generated: `node --experimental-strip-types scripts/gen_agent_files.ts`; a test fails on drift.
- Adding a tool: add it to `TOOLS` AND to `FIXTURES` in test/agent.test.ts, or the coverage test fails.

## Ten-agent kill-test harness (C7)
`node --experimental-strip-types scripts/agents10.ts` runs 10 independent synthetic agents (own account, key and client identity) against the in-process handler: agent card + llms.txt discovery, MCP initialize and tools/list, one `domain_check` call with an Idempotency-Key, receipt signature verified offline, same-key replay (same receipt, no second charge). Prints a JSON scorecard. Tests: `test/agents10.test.ts` (tamper, unscoped key, no credits, wrong secret, cross-agent idempotency mutants). Live use is refused unless `AGENTS10_LIVE_OK=1` and is a gated action (needs a deployed Worker and D1).
