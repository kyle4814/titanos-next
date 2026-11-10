// f375 (C2): the owner rejection branches f368 did not exercise, ONE TEST PER BRANCH so a mutant that re-introduces the bump fails the named test.
// Each asserts: the request was refused (4xx), the full state dump (every store row, the rev, the zone) is byte-identical, the rev is the same number,
// and the audit rows (events and fixes, read straight from the store) are unchanged. Memory and FakeD1 (D1OwnerStore, real migrations). SYNTHETIC data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerRejectedPaths } from "./post_fuzz_lib.ts";
import { buildOwnerRejectRig as build } from "./owner_reject_rig.ts";

const PATHS = ["scan scan_too_soon", "fix invalid_check", "undo no_such_fix", "fix no_zone", "undo no_zone"] as const;
for (const kind of ["memory", "d1"] as const) for (const path of PATHS) {
  test(`f375 ${kind}: ${path} leaves state, rev and audit rows byte-identical`, async () => {
    const R = await build(kind);
    const cs = await ownerRejectedPaths(R, [path]);
    const c = cs.find((x) => x.path === path);
    assert.ok(c, `${path} was reached`);
    assert.ok(c.status < 500 && !/"result":"(proven|partial)"/.test(c.reason), `${path}: refused (a 4xx, or the 200 {result:<reason>} fix contract), got ${c.status} ${c.reason}`);
    assert.equal(c.changed, false, `${path}: STATE CHANGED`);
    assert.equal(typeof c.revBefore, "number", `${path}: rev readable`);
    assert.equal(c.revAfter, c.revBefore, `${path}: rev bumped`);
    assert.ok(c.auditBefore && c.auditBefore !== '{"events":null,"fixes":null}', `${path}: audit rows readable from the store`);
    assert.equal(c.auditAfter, c.auditBefore, `${path}: audit rows (events, fixes) changed`);
  });
}
