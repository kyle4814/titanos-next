#!/usr/bin/env node
// C8 f311 partner-book mutation check. Plants each mutant, runs test/partner_book.test.ts (plus the f64 isolation matrix for
// the guard mutants), expects the run to FAIL (killed). Always restores the original bytes. Run: node scripts/mutate_partner_book.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const api = join(dirname(fileURLToPath(import.meta.url)), "..", "portal-api");
const B = "src/enterprise/partner_book.ts", S = "src/enterprise/service.ts", R = "src/enterprise/routes.ts";
const BOTH = ["test/partner_book.test.ts", "test/tenant_isolation.test.ts"], ONLY = ["test/partner_book.test.ts"];
const M = [
  [B, "guard: membership not required", "if (!partner || !mem ||", "if (!partner ||", BOTH],
  [B, "guard: viewer may read the book", "ROLE_RANK[mem.role] < ROLE_RANK.analyst", "false", ONLY],
  [B, "guard: client tenant accepted as a partner seat", 'partner.kind === "partner" ? await store.memberOf', "true ? await store.memberOf", ONLY],
  [B, "guard: deleted partner still served", "partner && !partner.deletedAt && partner.kind", "partner && partner.kind", ONLY],
  [B, "403 carries a body", "export const FORBIDDEN: BookResult = { status: 403, body: null };", 'export const FORBIDDEN: BookResult = { status: 403, body: {} as never };', BOTH],
  [B, "ledger read not re-scoped to the partner", "(await store.ledgerOf(partner.id)).filter((x) => x.partnerId === partner.id)", "(await store.ledgerOf(partner.id))", ONLY],
  [B, "children read not re-scoped to the partner", "t.parentId === partner.id && t.kind === \"client\");\n  const bySource", "t.kind === \"client\");\n  const bySource", ONLY],
  [B, "row accepted for a tenant that is not this partner's child", "found && found.parentId === partner.id && found.kind", "found && found.kind", ONLY],
  [B, "clawbacks ignored in a row's share", "shareCents: comm + claw, heldCents: heldC, lastRescanProofId: f?.lastRescanProofId", "shareCents: comm, heldCents: heldC, lastRescanProofId: f?.lastRescanProofId", ONLY],
  [B, "total drops clawbacks", "clients: rows.length, accruedCents: commission + clawback,", "clients: rows.length, accruedCents: commission,", ONLY],
  [B, "total counts payouts as accrued", "if (x.kind === \"payout\" || x.kind === \"payout_reversal\") { paidOut += x.amountCents; continue; }", "if (x.kind === \"payout\" || x.kind === \"payout_reversal\") { paidOut += x.amountCents; commission += x.amountCents; continue; }", ONLY],
  [B, "unsourced cents hidden", "unsourcedCents: commission + clawback - shown,", "unsourcedCents: 0,", ONLY],
  [B, "fully refunded client not flagged", "const fullyRefunded = comm > 0 && comm + claw <= 0;", "const fullyRefunded = false;", ONLY],
  [B, "deleted client shown as live", 'status: t.deletedAt ? "closed" : fullyRefunded', "status: fullyRefunded", ONLY],
  [B, "cursor not bound to the partner", "|| m[1] !== (await sha256Hex(partnerId)).slice(0, 16)", "", ONLY],
  [B, "cursor binding checks the format only", "m[1] !== (await sha256Hex(partnerId)).slice(0, 16)", "false", ONLY],
  [B, "cursor repeats the boundary row", "rows.findIndex((r) => r.key > after!) === -1 ? rows.length : rows.findIndex((r) => r.key > after!)", "rows.findIndex((r) => r.key >= after!) === -1 ? rows.length : rows.findIndex((r) => r.key >= after!)", ONLY],
  [B, "limit uncapped", "n < 1 || n > BOOK_MAX_LIMIT", "n < 1", ONLY],
  [B, "bad cursor ignored instead of refused", "if (after === undefined) return { status: 400, body: { error: \"invalid_cursor\" } };", "", ONLY],
  [B, "totals computed from the page only", "const shown = rows.reduce(", "const shownAll = rows.reduce(", ONLY],
  [S, "wrapper: non-member gets a 404 instead of the empty 403", "if (e instanceof HttpError && (e.status === 404 || e.status === 403)) return FORBIDDEN; throw e;", "throw e;", ONLY],
  [S, "wrapper: guard skipped", 'try { await access(d, ctx, pid, "analyst", "partner"); }', 'try { /* skipped */ }', ONLY],
  [S, "wrapper: omitted partnerId falls to the first partner of anyone", "if (mine.length !== 1) return FORBIDDEN;", "if (mine.length < 1) return FORBIDDEN;", ONLY],
  [R, "route: /api spelling not served", 'if (path === "/api/partner/book") path = "/partner/book";', "", ONLY],
  [R, "route: 403 emitted with a JSON body", "r.body === null ? new Response(null, { status: r.status,", "r.body === null ? new Response('{}', { status: r.status,", BOTH],
];
const read = (f) => readFileSync(join(api, f), "utf8");
const origs = new Map(); for (const f of new Set(M.map((m) => m[0]))) origs.set(f, read(f));
const restore = () => { for (const [f, s] of origs) writeFileSync(join(api, f), s); };
const run = (tests) => spawnSync("node", ["--test", "--experimental-strip-types", ...tests], { cwd: api, encoding: "utf8", timeout: 300000 });
let killed = 0; const survived = [], skipped = [];
try {
  const base = run(BOTH);
  if (base.status !== 0) { console.error("BASELINE FAILS"); process.exitCode = 2; throw new Error("baseline"); }
  for (const [f, name, from, to, tests] of M) {
    const src = origs.get(f);
    if (!src.includes(from)) { skipped.push(name); console.log("SKIP (pattern not found)", name); continue; }
    writeFileSync(join(api, f), src.replace(from, to));
    const r = run(tests); restore();
    if (r.status !== 0) { killed++; console.log("killed  ", name); } else { survived.push(name); console.log("SURVIVED", name); }
  }
} catch (e) { if (e.message !== "baseline") throw e; } finally { restore(); }
console.log(`mutants: ${killed} killed, ${survived.length} survived, ${skipped.length} skipped of ${M.length}`);
if (survived.length || skipped.length) process.exitCode = 1;
