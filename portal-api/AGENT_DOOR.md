# Agent door (C7)

Code: `src/agent/` (tools, mcp, credits, receipt, files). Tests: `test/agent.test.ts`. Migration 0003 (written, NOT applied, GATE5).

- `POST /mcp`: MCP over HTTP, JSON-RPC 2.0, `Authorization: Bearer tk_...`. Methods: initialize, ping, tools/list, tools/call.
- Scopes: catalogue:read, scan:read, account:read, credits:read, explain:model, receipt:verify. A key sees and calls only its scopes.
- Billing: 1 credit = AU$0.01 (EXAMPLE rate). Prepaid debit before the run, reversal on failure. `explain_finding` is the only model-backed tool: caller key in `x-model-key` (BYOK, never stored) costs 0, otherwise 25 credits.
- Receipts: HMAC-SHA256 over id|tool|key|account|at|inputSha|outputSha|credits|mode with `receiptSecret` (Deps; unset = every call refused).
- Public: `GET /agent/tools`, `GET /.well-known/agent.json`, `POST /agent/receipts/verify`.
- Account: `GET /agent/credits`, `POST /agent/credits/topup {pack}` (mock checkout; webhook grants credits).
- Site copies are generated: `node --experimental-strip-types scripts/gen_agent_files.ts`; a test fails on drift.
- Adding a tool: add it to `TOOLS` AND to `FIXTURES` in test/agent.test.ts, or the coverage test fails.

## Ten-agent kill-test harness (C7)
`node --experimental-strip-types scripts/agents10.ts` runs 10 independent synthetic agents (own account, key and client identity) against the in-process handler: agent card + llms.txt discovery, MCP initialize and tools/list, one `domain_check` call with an Idempotency-Key, receipt signature verified offline, same-key replay (same receipt, no second charge). Prints a JSON scorecard. Tests: `test/agents10.test.ts` (tamper, unscoped key, no credits, wrong secret, cross-agent idempotency mutants). Live use is refused unless `AGENTS10_LIVE_OK=1` and is a gated action (needs a deployed Worker and D1).

## D1 persistence (F58)
`src/agent/d1agent.ts` (D1AgentStore) persists api_keys, agent_receipts, credit_ledger, credit_orders, agent_calls, plus the F17 idempotency reserve and the F19 per-key spend cap, each as one atomic statement. Migration 0006 (written, NOT applied, GATE5): key caps, ledger `key_id`, append-only triggers, `idem_reservations`. `account_id` is the tenant key. Run the same suite on both stores: `npm test` (memory) and `npm run test:d1agent` (agent door on a fake D1 over real SQLite). `test/fake_d1.ts` is a copy from the unmerged F13 branch.
