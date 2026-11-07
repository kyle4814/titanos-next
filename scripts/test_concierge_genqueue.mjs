// C5 GeneratorQueue tests. SYNTHETIC asks only (invented, labelled; no real asker, email or number).
import fs from "node:fs";
import { enqueueDemand, mergeDemand, MemoryQueue, RecordingQueue } from "../lib/concierge/genqueue.ts";
import { demandReport } from "../lib/concierge/demand.ts";
import { gradeShelf, visibleShelves } from "../lib/shop/grader.ts";

let pass = 0, fail = 0;
const t = (n, ok, x = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + n + " " + x); } };
const A = (ask, askerId, seenAt) => ({ ask, askerId, seenAt });
const LOG = [
  A("Do you build wedding photography invoicing?", "u1", "2026-11-03T01:00:00Z"),
  A("wedding photography invoicing please", "u2", "2026-11-05T09:00:00Z"),
  A("can you do wedding photography invoices", "u3", "2026-11-01T00:00:00Z"),
  A("quote for roof inspection drones", "u4", "2026-11-04T00:00:00Z"),
  A("roof inspection drones quote", "u4", "2026-11-06T00:00:00Z"),
  A("what is the weather forecast tomorrow", "u5", "2026-11-02T00:00:00Z"),
];
const q = new RecordingQueue();
const r1 = enqueueDemand(q, LOG);
t("Q1 ranking order", r1.entries.length === 2 && r1.entries[0].label.includes("wedd") && r1.entries[0].distinct_askers === 3 && r1.entries[1].distinct_askers === 1, JSON.stringify(r1.entries));
t("Q2 status + first/last seen", r1.entries.every((e) => e.status === "QUEUED_FOR_GENERATOR") && r1.entries[0].first_seen === "2026-11-01T00:00:00Z" && r1.entries[0].last_seen === "2026-11-05T09:00:00Z");
t("Q3 off-topic never queued", !q.list().some((e) => /weath/.test(e.label)));
// KILL TEST: re-run over the same log changes nothing.
const snap = JSON.stringify(q.list()), w = q.writes;
const r2 = enqueueDemand(q, LOG), r3 = enqueueDemand(q, [...LOG].reverse());
t("Q4 KILL: re-run identical, zero writes", JSON.stringify(q.list()) === snap && q.writes === w && !r2.changed && !r3.changed, JSON.stringify(q.list()));
// Growth: new asks update counts and last_seen, near-duplicate joins the same entry, no new row.
const more = [...LOG, A("wedding photography invoicing tool", "u6", "2026-11-07T00:00:00Z")];
const r4 = enqueueDemand(q, more);
t("Q5 near-duplicate merges, counts grow", r4.entries.length === 2 && r4.entries[0].ask_count === 4 && r4.entries[0].distinct_askers === 4 && r4.entries[0].last_seen === "2026-11-07T00:00:00Z" && r4.entries[0].first_seen === "2026-11-01T00:00:00Z" && r4.changed, JSON.stringify(r4.entries));
// A drifting cluster id (different rep) still merges onto the existing row by label similarity.
const drift = mergeDemand(q.list(), [{ cluster_id: "dc-ffffffff", label: "invoic photography wedd", ask_count: 2, distinct_askers: 2, sample_asks: ["x"], status: "UNGRADED_PROPOSAL", first_seen: "2026-10-30T00:00:00Z", last_seen: null }]);
t("Q6 drifted id merges by label", drift.length === 2 && drift.some((e) => e.first_seen === "2026-10-30T00:00:00Z"), JSON.stringify(drift));
// Shorter log never shrinks demand.
const r5 = enqueueDemand(q, LOG.slice(0, 1));
t("Q7 shorter log cannot shrink", r5.entries[0].ask_count >= 4 && !r5.changed);
// Empty / junk logs.
const e = new MemoryQueue();
t("Q8 empty log", enqueueDemand(e, []).queued === 0 && enqueueDemand(e, undefined).queued === 0 && enqueueDemand(e, [null, {}, { ask: 5 }]).queued === 0 && e.list().length === 0);
t("Q8b empty log leaves existing queue", enqueueDemand(q, []).entries.length === 2);
// Input-order invariance from a cold queue.
const a = new MemoryQueue(), b = new MemoryQueue();
enqueueDemand(a, LOG); enqueueDemand(b, [...LOG].reverse());
t("Q9 order invariant", JSON.stringify(a.list()) === JSON.stringify(b.list()));
// Records without timestamps: null seen, still stable.
const n = new MemoryQueue(); enqueueDemand(n, [A("roof inspection drones", "u1"), A("roof inspection drones", "u2")]);
t("Q10 no seenAt -> null", n.list()[0].first_seen === null && n.list()[0].last_seen === null && n.list()[0].distinct_askers === 2);
// Adapters return copies; mutating them cannot corrupt the store.
const l = q.list(); l[0].ask_count = 999;
t("Q11 list() is a copy", q.list()[0].ask_count !== 999);
// Ungraded entries stay out of the shelf door and the sitemap.
t("Q12 entry cannot pass grader / visibleShelves", gradeShelf(q.list()[0]).pass !== true && visibleShelves([q.list()[0]]).length === 0);
const src = fs.readFileSync(new URL("../lib/concierge/genqueue.ts", import.meta.url), "utf8");
t("Q13 pure: no clock/network/fs/random", !/Date\.now|new Date|Math\.random|fetch\(|node:fs|process\.env/.test(src));
const root = new URL("..", import.meta.url).pathname;
t("Q14 not wired to sitemap/routes/shop", ["app/sitemap.ts", "lib/routes.ts", "lib/shop/loader.ts", "scripts/build_shop.mjs"].every((f) => !fs.existsSync(root + f) || !/genqueue/.test(fs.readFileSync(root + f, "utf8"))));
// demand.ts regression: first/last seen present on stubs.
const d = demandReport(LOG)[0];
t("Q15 demand stub carries first/last", d.first_seen === "2026-11-01T00:00:00Z" && d.last_seen === "2026-11-05T09:00:00Z");
console.log(`genqueue: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
