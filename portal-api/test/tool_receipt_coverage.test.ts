import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS, type ToolDef } from "../src/agent/tools.ts";
import { audit, realDoor, formatMatrix, type Door, type Row } from "./tool_receipt_gate.ts";

const door = realDoor();
const failing = (rows: Row[]) => rows.filter((r) => !r.pass);
const wrap = (mut: (tool: ToolDef, scopes: string[], out: any) => void): Door => ({ async call(t, a, s) { const out = await door.call(t, a, s); mut(t, s, out); return out; } });

test("tool receipt coverage: every tool in the live catalogue passes every invariant (matrix printed)", async () => {
  assert.ok(TOOLS.length >= 7, "catalogue read, not empty");
  const rows = await audit(TOOLS, door);
  console.log("\n" + formatMatrix(rows) + `\n${rows.filter((r) => r.pass).length}/${rows.length} tools pass`);
  assert.deepEqual(failing(rows).map((r) => `${r.tool}: ${r.fails.join(";")}`), []);
  assert.equal(new Set(rows.map((r) => r.tool)).size, TOOLS.length, "no duplicate tool names");
});

// ---- mutants: each must turn the gate red for the tool it breaks and only that tool ----
test("mutant 1: a tool whose receipt is removed is caught", async () => {
  const rows = await audit(TOOLS, wrap((t, s, o) => { if (t.name === "price_quote" && s.includes(t.scope)) delete o.body.result.structuredContent.receipt; }));
  assert.deepEqual(failing(rows).map((r) => r.tool), ["price_quote"]);
  assert.match(failing(rows)[0].fails.join(), /no_receipt_on_allowed_call/);
});
test("mutant 2: an added tool with no receipt test is caught", async () => {
  const ghost: ToolDef = { ...TOOLS[0], name: "ghost_untested_tool" };
  TOOLS.push(ghost);
  try {
    const rows = await audit(TOOLS, door);
    const bad = failing(rows);
    assert.deepEqual(bad.map((r) => r.tool), ["ghost_untested_tool"]);
    assert.match(bad[0].fails.join(), /no_receipt_test_file/); assert.match(bad[0].fails.join(), /no_fixture/);
  } finally { TOOLS.pop(); }
  assert.equal(TOOLS.some((t) => t.name === "ghost_untested_tool"), false, "catalogue restored");
});
test("mutant 3: a tool with its scope dropped is caught", async () => {
  const t = TOOLS.find((x) => x.name === "my_domains")!, saved = t.scope;
  (t as any).scope = undefined;
  try {
    const bad = failing(await audit(TOOLS, door));
    assert.deepEqual(bad.map((r) => r.tool), ["my_domains"]);
    assert.match(bad[0].fails.join(), /scope_not_declared/);
  } finally { (t as any).scope = saved; }
  assert.equal(t.scope, "account:read");
});
test("mutant 4: a receipt returned on a refused call is caught", async () => {
  const rows = await audit(TOOLS, wrap((t, s, o) => { if (t.name === "credits_balance" && !s.includes(t.scope)) o.body.result.structuredContent.receipt = { id: "rcpt_" + "0".repeat(24) }; }));
  assert.deepEqual(failing(rows).map((r) => r.tool), ["credits_balance"]);
  assert.match(failing(rows)[0].fails.join(), /receipt_on_refused_call/);
});
test("mutants 5-6 (extra): wrong cost and wrong input hash on the receipt are caught", async () => {
  const cost = await audit(TOOLS, wrap((t, s, o) => { if (t.name === "domain_check" && s.includes(t.scope)) o.body.result.structuredContent.receipt.credits = 0; }));
  assert.deepEqual(failing(cost).map((r) => r.tool), ["domain_check"]); assert.match(failing(cost)[0].fails.join(), /receipt_cost_wrong/);
  const hash = await audit(TOOLS, wrap((t, s, o) => { if (t.name === "catalogue_list" && s.includes(t.scope)) o.body.result.structuredContent.receipt.inputSha = "0".repeat(64); }));
  assert.deepEqual(failing(hash).map((r) => r.tool), ["catalogue_list"]); assert.match(failing(hash)[0].fails.join(), /receipt_input_hash_wrong/);
});
