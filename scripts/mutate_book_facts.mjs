#!/usr/bin/env node
// C8 f313 book-facts mutation check. Plants each mutant, runs test/book_facts.test.ts (+ partner_book.test.ts), expects the run to FAIL (killed). Always restores the original bytes. Run: node scripts/mutate_book_facts.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const B = "src/enterprise/partner_book.ts", F = "src/enterprise/book_facts.ts", E = "src/enterprise/store.ts";
const T = ["test/book_facts.test.ts", "test/partner_book.test.ts"];
const api = join(dirname(fileURLToPath(import.meta.url)), "..", "portal-api");

const M = [
  [B, "referral hash index made global (any partner's referral resolves)", "(await store.referralsOfPartner(partner.id)).filter((x) => x.partnerId === partner.id)", "[...(store as any).referrals.values()]", T],
  [E, "referralsOfPartner returns every partner's rows", "[...this.referrals.values()].filter((r) => r.partnerId === p)", "[...this.referrals.values()]", T],
  [B, "unattributed hash guessed (falls back to first referral)", "const acct = refHashes.get(key.slice(4)) ?? undefined;", "const acct = refHashes.get(key.slice(4)) ?? [...refHashes.values()][0] ?? undefined;", T],
  [B, "hash collision resolved by last writer instead of ambiguous", "refHashes.set(h, refHashes.has(h) ? null : r.accountId);", "refHashes.set(h, r.accountId);", T],
  [B, "unattributed referral still labelled attributed", 'identity: known ? "attributed" : "unattributed"', 'identity: "attributed"', T],
  [B, "totals off by a cent", "accruedCents: commission + clawback, commissionCents", "accruedCents: commission + clawback + 1, commissionCents", T],
  [B, "facts not scoped to the calling partner", "await facts.factsFor(t.id, partner.id)", "await facts.factsFor(t.id)", T],
  [F, "proof taken from any job of the account regardless of domain", "norm(p.domain) === norm(domain)", "true", T],
  [F, "oldest proof wins", "b.at - a.at || (a.scanId < b.scanId ? -1 : 1))[0];\n  return", "a.at - b.at || (a.scanId < b.scanId ? -1 : 1))[0];\n  return", T],
  [F, "memory: client of another partner served", "(partnerId !== undefined && t.parentId !== partnerId)", "false", T],
  [F, "memory: referral served to any partner", "if (!r || r.partnerId !== partnerId) return undefined;", "if (!r) return undefined;", T],
  [F, "d1: client of another partner served", "(partnerId !== undefined && String(t.parent_id) !== partnerId)", "false", T],
  [F, "d1: referral served to any partner", "AND partner_id = ?\", accountId, partnerId", "\", accountId", T],
  [F, "d1: proof query ignores the owner (all accounts' jobs)", "FROM market_jobs WHERE owner_account_id IN (${m}) AND status", "FROM market_jobs WHERE 1=1 AND status", T],
  [F, "d1: subscription plan_json ignored", "tier: plan.tier, endedAt: plan.endedAt", "tier: undefined, endedAt: plan.endedAt", T],
  [F, "cancelled subscription reported active", 'sub.cancelledAt !== undefined || sub.endedAt !== undefined ? "cancelled"', 'sub.endedAt !== undefined ? "cancelled"', T],
  [F, "unverified domain preferred", "Number(b.verified) - Number(a.verified)", "Number(a.verified) - Number(b.verified)", T],
  [F, "facts source error swallowed to empty facts", "const t = await ent.tenantById(clientTenantId);", "const t = await ent.tenantById(clientTenantId).catch(() => undefined);", T],
  [F, "estate consent ignored (domain and proof shown for unconsented client)", "return consented ? { ...f, estateConsent: true } : { ...f, domain: null, lastRescanProofId: null, estateConsent: false };", "return { ...f, estateConsent: consented };", T],
];
const read = (f) => readFileSync(join(api, f), "utf8");
const origs = new Map(); for (const f of new Set(M.map((m) => m[0]))) origs.set(f, read(f));
const restore = () => { for (const [f, s] of origs) writeFileSync(join(api, f), s); };
const run = (tests) => spawnSync("node", ["--test", "--experimental-strip-types", ...tests], { cwd: api, encoding: "utf8", timeout: 300000 });
let killed = 0; const survived = [], skipped = [];
try {
  const base = run(T);
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
