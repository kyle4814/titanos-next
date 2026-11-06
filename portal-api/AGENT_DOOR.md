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
