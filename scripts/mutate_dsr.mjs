#!/usr/bin/env node
// C2 data-rights mutation check. Applies each mutant to portal-api/src/dsr.ts (or store.ts), runs test/dsr.test.ts,
// expects it to FAIL (killed). Known equivalent mutant, not listed: dropping dsr.ts deleteSessionsFor, because MemoryStore.anonymiseAccount also deletes sessions (the explicit call guards other adapters). Always restores the original bytes. Run: node scripts/mutate_dsr.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const api = join(dirname(fileURLToPath(import.meta.url)), "..", "portal-api");
const D = "src/dsr.ts", S = "src/store.ts";
const M = [
  [D, "export leaks api key hash", "scopes: k.scopes, createdAt: k.createdAt,", "scopes: k.scopes, hash: k.hash, createdAt: k.createdAt,"],
  [D, "export leaks DNS verification token", "domain: x.domain, verifiedAt", "domain: x.domain, token: x.token, verifiedAt"],
  [D, "export leaks receipt signature", "const { sig: _sig, ...rest } = r; return rest;", "return r;"],
  [D, "export drops the account filter on audit (other admin rows leak)", ".filter((x) => x.actor === accountId)", ""],
  [D, "export unmasks counterparty ids", 'ownerAccountId: mine ? me : "counterparty"', "ownerAccountId: j.ownerAccountId"],
  [D, "erase ignores held payouts", 'if (await partnerPayoutsInPlay(d.ent, accountId)) out.add("payout_held");', ""],
  [D, "payout settled set treats unknown status as settled", "if ((await e.payoutsOf(t.id)).some((p) => !PAYOUT_SETTLED.has(p.status))) return true;", 'if ((await e.payoutsOf(t.id)).some((p) => ["pending_approval", "sending"].includes(p.status))) return true;'],
  [D, "erase ignores in-policy refundable order", 'refundVerdict(prod, p.paidAt, now, p.deliverableIssued, false).auto) out.add("order_refundable_in_policy");', 'false) out.add("order_refundable_in_policy");'],
  [D, "erase ignores last admin", 'if (await soleAdminSomewhere(d.ent, accountId)) out.add("last_admin_of_tenant");', ""],
  [D, "erase ignores active subscription", 'if (!s.cancelledAt) out.add("active_subscription");', ""],
  [D, "erase keeps the email (no pseudonym applied)", "email: erasedEmail(pseudonym), stripeCustomerId: undefined, deletedAt: at", "stripeCustomerId: undefined, deletedAt: at"],
  [D, "pseudonym not stable (time based)", '(await sha256Hex(`${salt}:${accountId}`)).slice(0, 16)', '(await sha256Hex(`${salt}:${accountId}:${Date.now()}`)).slice(0, 16)'],
  [D, "erasedAt drifts on rerun", "const s = d.store, at = a.deletedAt ?? d.now();", "const s = d.store, at = d.now();"],
  [D, "blockers re-checked after erase (second run refuses)", "if (!a.deletedAt) { // first run only", "if (true) { // first run only"],
  [D, "outstanding login link not purged", "if (!a.deletedAt) await s.purgeLoginStateFor(oldEmail);", ""],
  [D, "membership not removed", "await d.ent.removeAccount(accountId);", ""],
  [D, "connect ref kept on pro profile", "display: pseudonym, connectAccountId: undefined, onboarded: false", "display: pseudonym, onboarded: false"],
  [S, "store: purgeLoginStateFor deletes every address", "if (t.email === email) this.loginTokens.delete(k);", "this.loginTokens.delete(k);"],
  [S, "store: receiptsFor ignores the account (cross-tenant)", "[...this.receipts.values()].filter((r) => r.accountId === id)", "[...this.receipts.values()]"],
  [S, "store: cardsFor ignores the account (cross-tenant)", "[...this.cards.values()].filter((c) => c.accountId === id)", "[...this.cards.values()]"],
];
const read = (f) => readFileSync(join(api, f), "utf8");
const origs = new Map(); for (const f of new Set(M.map((m) => m[0]))) origs.set(f, read(f));
const restore = () => { for (const [f, s] of origs) writeFileSync(join(api, f), s); };
const run = () => spawnSync("node", ["--test", "--experimental-strip-types", "test/dsr.test.ts"], { cwd: api, encoding: "utf8", timeout: 120000 });
let killed = 0; const survived = [], skipped = [];
try {
  const base = run();
  if (base.status !== 0) { console.error("BASELINE FAILS"); process.exitCode = 2; throw new Error("baseline"); }
  for (const [f, name, from, to] of M) {
    const src = origs.get(f);
    if (!src.includes(from)) { skipped.push(name); console.log("SKIP (pattern not found)", name); continue; }
    writeFileSync(join(api, f), src.replace(from, to));
    const r = run(); restore();
    if (r.status !== 0) { killed++; console.log("killed  ", name); } else { survived.push(name); console.log("SURVIVED", name); }
  }
} catch (e) { if (e.message !== "baseline") throw e; } finally { restore(); }
console.log(`mutants: ${killed} killed, ${survived.length} survived, ${skipped.length} skipped of ${M.length}`);
if (survived.length || skipped.length) process.exitCode = 1;
