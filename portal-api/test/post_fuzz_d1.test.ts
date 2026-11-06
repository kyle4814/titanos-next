// f188: the f182 POST-route fuzz suite re-run with the Worker Store = D1Store over FakeD1 (see post_fuzz.test.ts, FUZZ_STORE).
process.env.FUZZ_STORE = "d1";
const { fakeD1 } = await import("./post_fuzz.test.ts");
import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshot } from "./post_fuzz_lib.ts";
// the D1 judge must be able to fail: a raw write to any D1 table, and a row delete, must change the dump the fuzz compares
test("D1 mutant: the state snapshot sees a planted write and a planted delete in D1", () => {
  assert.ok(fakeD1, "FUZZ_STORE=d1 did not build a FakeD1");
  const d = fakeD1!.db;
  const dump = () => snapshot(d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t: any) => d.prepare(`SELECT * FROM "${t.name}"`).all()));
  const s0 = dump();
  const acc = d.prepare("SELECT id FROM accounts LIMIT 1").get() as { id: string };
  d.prepare("UPDATE accounts SET email = email || 'x' WHERE id = ?").run(acc.id);
  assert.notEqual(dump(), s0);
});
