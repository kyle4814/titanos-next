// f368 (C2/C3): a REJECTED owner request must leave the domain's rev and every row byte-identical. ALL DATA IS SYNTHETIC (.example zones, no network).
// The paths come from service.ts tx(): a body that returns ok:false without having mutated state used to go on to casTx -> putCas and bump rev.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerRejectedPaths } from "./post_fuzz_lib.ts";
import { buildOwnerRejectRig as build } from "./owner_reject_rig.ts";

for (const kind of ["memory", "d1"] as const) {
  test(`f368 ${kind}: every owner rejection leaves rev and all rows byte-identical`, async () => {
    const R = await build(kind);
    const cases = await ownerRejectedPaths(R);
    assert.deepEqual(cases.map((c) => c.path).sort(), ["fix not_open", "fix unknown_check", "undo already_reverted", "undo zone_changed_since"], "every rejected path was reached");
    for (const c of cases) { assert.ok(c.status < 500 && !/"proven"/.test(c.reason), `${c.path}: not a 5xx and not a success, got ${c.status} ${c.reason}`); }
    assert.deepEqual(cases.filter((c) => c.changed).map((c) => c.path), [], "STATE CHANGED on a rejected request");
  });
  test(`f368 ${kind}: the domain rev is exactly the same number after each rejection`, async () => {
    const R = await build(kind);
    for (const c of await ownerRejectedPaths(R)) { assert.equal(typeof c.revBefore, "number", c.path); assert.equal(c.revAfter, c.revBefore, `${c.path}: rev bumped`); }
  });
}
