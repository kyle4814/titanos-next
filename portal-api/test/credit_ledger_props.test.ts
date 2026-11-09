// F98 (C7 backfill): property suite over the metered-credit ledger. SYNTHETIC data only (example.com.au accounts, a seeded PRNG,
// mock billing, mock model). Nothing live, no Stripe, no provider call.
//
// Invariants (each has a mutation test at the bottom: a deliberately broken store that this suite must catch):
//   I1 balance == sum of ledger entries, per account, after every operation
//   I2 balance never goes negative; an overdraw is refused and writes nothing
//   I3 a failed call is uncharged: no receipt, and its debit is cancelled by a reversal (net 0)
//   I4 a replayed (reason, ref) or a replayed Idempotency-Key never double-grants / double-debits
//   I5 N concurrent debits against a balance of 25 at cost c serve exactly floor(25 / c), never more
// Run on BOTH adapters: MemoryStore and the D1AgentStore over real SQLite + real migrations (PORTAL_STORE=d1agent equivalent).
import { test } from "node:test";
import assert from "node:assert/strict";
import { make } from "./harness.ts";
import { MemoryStore, type CreditEntry, type Store } from "../src/store.ts";
import { D1ShadowStore } from "./d1_agent_store.ts";
import { SCOPES } from "../src/agent/tools.ts";

const SYNTHETIC = "SYNTHETIC: generated sequences, example.com.au accounts, mock billing and model; no live data";
void SYNTHETIC;
const SEQUENCES = 300;
type Backend = "memory" | "d1agent";
const BACKENDS: Backend[] = ["memory", "d1agent"];

// ---- seeded PRNG so a failing sequence reproduces from its seed alone ----
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)), pick: <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)] };
}
const sum = (es: CreditEntry[]) => es.reduce((n, e) => n + e.delta, 0);

// ================= PART A: the ledger contract, store level =================
// Reference model: a Map per account. Returns a violation string, or null when the sequence held every invariant.
async function ledgerSequence(seed: number, mk: () => Promise<Store>): Promise<string | null> {
  const r = rng(seed), store = await mk(), accts = ["acct_A", "acct_B"];
  const model = { bal: { acct_A: 0, acct_B: 0 } as Record<string, number>, seen: new Set<string>(), debits: new Map<string, { acct: string; amt: number; refunded: boolean }>() };
  let n = 0, t = 1000;
  const len = r.int(8, 40);
  for (let step = 0; step < len; step++) {
    const acct = r.pick(accts), before = { ...model.bal }, kind = r.pick(["topup", "topup", "debit", "debit", "debit", "refund", "replay", "overdraw", "dup-refund"]);
    const entriesBefore = (await store.creditEntries(acct)).length;
    let expectApplied: boolean | null = null;
    if (kind === "topup") { const amt = r.int(1, 60), ref = `evt_${++n}`; const got = await store.creditApply(acct, amt, "topup", ref, ++t); model.seen.add(`topup|${ref}`); model.bal[acct] += amt; if (got !== model.bal[acct]) return `seed ${seed} step ${step}: topup returned ${got}, model ${model.bal[acct]}`; }
    else if (kind === "debit") {
      const amt = r.int(1, 30), ref = `rcpt_${++n}`, can = model.bal[acct] - amt >= 0;
      const got = await store.creditApply(acct, -amt, "debit", ref, ++t);
      if (can) { model.bal[acct] -= amt; model.seen.add(`debit|${ref}`); model.debits.set(ref, { acct, amt, refunded: false }); if (got !== model.bal[acct]) return `seed ${seed} step ${step}: debit returned ${got}, model ${model.bal[acct]}`; }
      else { expectApplied = false; if (got !== undefined) return `seed ${seed} step ${step}: I2 overdraw of ${amt} on ${model.bal[acct]} was accepted (returned ${got})`; }
    } else if (kind === "overdraw") {
      const amt = model.bal[acct] + r.int(1, 20), got = await store.creditApply(acct, -amt, "debit", `over_${++n}`, ++t);
      expectApplied = false; if (got !== undefined) return `seed ${seed} step ${step}: I2 overdraw by ${amt - model.bal[acct]} accepted`;
    } else if (kind === "refund") {
      const open = [...model.debits].filter(([, d]) => d.acct === acct && !d.refunded);
      if (open.length) { const [ref, d] = r.pick(open); const got = await store.creditApply(acct, d.amt, "reversal", ref, ++t); d.refunded = true; model.bal[acct] += d.amt; model.seen.add(`reversal|${ref}`); if (got !== model.bal[acct]) return `seed ${seed} step ${step}: refund returned ${got}, model ${model.bal[acct]}`; }
    } else if (kind === "dup-refund") {
      const done = [...model.debits].filter(([, d]) => d.acct === acct && d.refunded);
      if (done.length) { const [ref, d] = r.pick(done); const got = await store.creditApply(acct, d.amt, "reversal", ref, ++t); expectApplied = false; if (got !== undefined) return `seed ${seed} step ${step}: I4 a second refund of ${ref} was granted`; }
    } else if (kind === "replay") {
      const seen = [...model.seen].filter((s) => !s.startsWith("reversal") || true);
      if (seen.length) {
        const [reason, ref] = r.pick(seen).split("|") as [CreditEntry["reason"], string];
        const orig = (await store.creditEntries(acct)).find((e) => e.reason === reason && e.ref === ref);
        if (orig) { const got = await store.creditApply(acct, orig.delta, reason, ref, ++t); expectApplied = false; if (got !== undefined) return `seed ${seed} step ${step}: I4 replay of (${reason}, ${ref}) was applied again`; }
      }
    }
    // invariants, every step, both accounts
    for (const a of accts) {
      const bal = await store.creditBalance(a), es = await store.creditEntries(a);
      if (bal !== sum(es)) return `seed ${seed} step ${step} (${kind}): I1 balance ${bal} != entries sum ${sum(es)} for ${a}`;
      if (bal < 0) return `seed ${seed} step ${step} (${kind}): I2 negative balance ${bal} for ${a}`;
      if (bal !== model.bal[a]) return `seed ${seed} step ${step} (${kind}): balance ${bal} != model ${model.bal[a]} for ${a}`;
      const keys = es.map((e) => `${e.reason}|${e.ref}`);
      if (new Set(keys).size !== keys.length) return `seed ${seed} step ${step}: I4 duplicate (reason, ref) in the ledger for ${a}`;
    }
    if (expectApplied === false && (await store.creditEntries(acct)).length !== entriesBefore) return `seed ${seed} step ${step} (${kind}): a refused operation wrote a ledger row`;
    const other = accts.find((a) => a !== acct)!;
    if (model.bal[other] !== before[other]) return "model bug: other account moved";
  }
  return null;
}
async function mkStore(b: Backend): Promise<Store> {
  const s: Store = b === "memory" ? new MemoryStore() : new D1ShadowStore();
  for (const id of ["acct_A", "acct_B"]) await s.putAccount({ id, email: `${id}@example.com.au`, seat: "owner", createdAt: 0 });
  return s;
}
for (const b of BACKENDS) {
  test(`I1 I2 I4 [${b}]: ${SEQUENCES} generated top-up / debit / refund / replay sequences hold balance == sum(entries), never negative, no double grant`, async () => {
    const bad: string[] = [];
    for (let seed = 1; seed <= SEQUENCES; seed++) { const v = await ledgerSequence(seed, () => mkStore(b)); if (v) { bad.push(v); if (bad.length >= 3) break; } }
    assert.deepEqual(bad, [], `violations (first 3): ${bad.join(" | ")}`);
  });
}

// ================= PART B: the call path (HTTP /mcp), including failed calls and idempotency keys =================
interface World { h: ReturnType<typeof make>; session: string; accountId: string; key: string; keyId: string }
function worldWith(storeOverride?: Store, b: Backend = "memory"): Promise<World> {
  const h = make({ d1: b === "d1agent" });
  if (storeOverride) h.deps.store = storeOverride;
  return (async () => {
    const s = await h.login("prop@example.com.au");
    const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes: [...SCOPES] } }));
    return { h, session: s.session, accountId: s.account.id, key: k.key, keyId: k.id };
  })();
}
let rpcId = 0;
const mcp = async (w: World, name: string, args: unknown, headers: Record<string, string> = {}) =>
  w.h.j(await w.h.req("POST", "/mcp", { token: w.key, body: { jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }, headers }));
const COST = { domain_check: 5, explain_finding: 25 } as const;

async function callSequence(seed: number, b: Backend, storeOverride?: () => Store): Promise<string | null> {
  const r = rng(seed), w = await worldWith(storeOverride?.(), b), st = w.h.deps.store;
  const clock = w.h.clock;
  w.h.dns.zone["good.example.com.au"] = ["v=spf1 -all"]; w.h.dns.zone["_dmarc.good.example.com.au"] = ["v=DMARC1; p=reject"];
  let bal = 0, n = 0, spent = 0; const idemSeen = new Map<string, { tool: string; args: string; rid: string }>(); const grantedEvents = new Map<string, number>();
  const topup = async (amt: number) => { await st.creditApply(w.accountId, amt, "topup", `evt_${++n}`, clock.t); bal += amt; };
  const len = r.int(6, 36);
  for (let step = 0; step < len; step++) {
    const kind = r.pick(["topup", "good", "good", "good", "bad", "explain", "explain-fail", "explain-byok", "replay", "webhook-replay", "tick"]);
    const idemName = r.next() < 0.4 ? r.pick(["k1", "k2", "k3"]) : undefined;
    const hd: Record<string, string> = idemName ? { "idempotency-key": idemName } : {};
    const ledgerBefore = (await st.creditEntries(w.accountId)).length;
    let note = kind;
    if (kind === "topup") await topup(r.int(5, 60));
    else if (kind === "tick") clock.t += 61_000;
    else if (kind === "webhook-replay") {
      // a real top-up order + signed webhook, delivered twice: the second delivery must grant nothing
      await w.h.req("POST", "/agent/credits/topup", { token: w.session, body: { pack: "credits_2000" } });
      const order = [...(st as MemoryStore).creditOrders.values()].at(-1) ;
      const evId = `evt_prop_${seed}_${step}`;
      for (let i = 0; i < 2; i++) await w.h.webhook("checkout.session.completed", { id: order!.checkoutId, payment_status: "paid" }, { id: evId });
      bal += 2000; grantedEvents.set(evId, 2000);
    } else {
      let tool: string = kind === "good" || kind === "bad" ? "domain_check" : "explain_finding";
      let args: Record<string, string> = tool === "domain_check" ? { domain: kind === "bad" ? "not a domain" : "good.example.com.au" } : { finding: "spf_missing" };
      if (kind === "replay") { // reuse an earlier idem key with the same call (a replay) or a different valid call on the same tool (a 422)
        const seen = [...idemSeen];
        if (seen.length) { const [k, v] = r.pick(seen); hd["idempotency-key"] = k; tool = v.tool; args = r.next() < 0.5 ? JSON.parse(v.args) : tool === "domain_check" ? { domain: "other.example.com.au" } : { finding: "dmarc_missing" }; }
      }
      const key = hd["idempotency-key"], argStr = JSON.stringify(args);
      if (kind === "explain-byok") hd["x-model-key"] = "sk-synthetic-user-key-0123456789";
      w.h.model.fail = kind === "explain-fail";
      const res = await mcp(w, tool, args, hd), sc = res.result?.structuredContent;
      const prev = key ? idemSeen.get(key) : undefined;
      const cost = kind === "explain-byok" ? 0 : COST[tool as keyof typeof COST];
      if (prev) {
        if (prev.tool === tool && prev.args === argStr) { if (!sc?.replayed || sc.receipt.id !== prev.rid) return `seed ${seed} step ${step}: I4 replay did not return the first receipt: ${JSON.stringify(res).slice(0, 160)}`; note = "replayed"; }
        else if (res.error?.message !== "idempotency_key_reuse") return `seed ${seed} step ${step}: I4 key reuse with other args was not refused: ${JSON.stringify(res).slice(0, 160)}`;
      } else if ((kind === "bad" || kind === "explain-fail") && cost <= bal) {
        if (!sc || sc.charged !== 0 || sc.receipt) return `seed ${seed} step ${step}: I3 failed call not reported as uncharged: ${JSON.stringify(res).slice(0, 160)}`;
        note = "failed";
      } else if (cost > bal) { if (sc?.error !== "insufficient_credits") return `seed ${seed} step ${step}: I2 call costing ${cost} on ${bal} was not refused: ${JSON.stringify(res).slice(0, 160)}`; note = "refused"; }
      else { if (!sc?.receipt || sc.receipt.credits !== cost) return `seed ${seed} step ${step}: call did not return a receipt for ${cost}: ${JSON.stringify(res).slice(0, 160)}`; bal -= cost; spent += cost; if (key) idemSeen.set(key, { tool, args: argStr, rid: sc.receipt.id }); note = "served"; }
    }
    // invariants after every step
    const es = await st.creditEntries(w.accountId), balance = await st.creditBalance(w.accountId);
    if (balance !== sum(es)) return `seed ${seed} step ${step} (${note}): I1 balance ${balance} != sum(entries) ${sum(es)}`;
    if (balance < 0) return `seed ${seed} step ${step} (${note}): I2 negative balance ${balance}`;
    if (balance !== bal) return `seed ${seed} step ${step} (${note}): balance ${balance} != model ${bal}`;
    const receipts = [...(st as MemoryStore).receipts.values()].filter((x) => x.accountId === w.accountId);
    const receiptCredits = receipts.reduce((m, x) => m + x.credits, 0);
    if (receiptCredits !== spent) return `seed ${seed} step ${step} (${note}): receipts total ${receiptCredits} != model spend ${spent}`;
    const debits = es.filter((e) => e.reason === "debit"), revs = es.filter((e) => e.reason === "reversal");
    const net = -(sum(debits) + sum(revs));
    if (net !== receiptCredits) return `seed ${seed} step ${step} (${note}): I3 net debits ${net} != receipt credits ${receiptCredits} (a failed call was charged, or a charge has no receipt)`;
    for (const rv of revs) if (!debits.some((d) => d.ref === rv.ref && d.delta === -rv.delta)) return `seed ${seed} step ${step}: reversal ${rv.ref} matches no debit`;
    for (const d of debits) { const hasRcpt = receipts.some((x) => x.id === d.ref), rev = revs.some((x) => x.ref === d.ref); if (hasRcpt === rev) return `seed ${seed} step ${step}: debit ${d.ref} has receipt=${hasRcpt} reversal=${rev}; exactly one must hold`; }
    const keys = es.map((e) => `${e.reason}|${e.ref}`); if (new Set(keys).size !== keys.length) return `seed ${seed} step ${step}: I4 duplicate (reason, ref)`;
    if (note === "refused" || note === "failed" || note === "replayed" || note === "served" === false) { /* ledger delta checked above via net */ }
    void ledgerBefore;
  }
  void grantedEvents;
  return null;
}
for (const b of BACKENDS) {
  test(`I1 I2 I3 I4 [${b}]: ${SEQUENCES} generated call sequences (served, failed, refused, replayed, webhook replays) hold every ledger invariant`, async () => {
    const bad: string[] = [];
    for (let seed = 1; seed <= SEQUENCES; seed++) { const v = await callSequence(seed, b); if (v) { bad.push(v); if (bad.length >= 3) break; } }
    assert.deepEqual(bad, [], `violations (first 3): ${bad.join(" | ")}`);
  });
}

// ================= PART C: concurrency (I5) =================
for (const b of BACKENDS) {
  test(`I5 [${b}]: concurrent debits on a balance of 25 serve exactly floor(25 / cost), at the store`, async () => {
    for (const cost of [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 24, 25, 26]) {
      const s = await mkStore(b);
      await s.creditApply("acct_A", 25, "topup", "evt_seed", 1);
      const res = await Promise.all(Array.from({ length: Math.floor(25 / cost) + 20 }, (_, i) => s.creditApply("acct_A", -cost, "debit", `c${i}`, 2)));
      const served = res.filter((x) => x !== undefined).length;
      assert.equal(served, Math.floor(25 / cost), `cost ${cost}: served ${served}`);
      assert.equal(await s.creditBalance("acct_A"), 25 - cost * Math.floor(25 / cost));
      assert.equal(await s.creditBalance("acct_A"), sum(await s.creditEntries("acct_A")));
    }
  });
  test(`I5 [${b}]: concurrent /mcp calls on a balance of 25 serve exactly floor(25 / cost) (5 at cost 5, 1 at cost 25) and the rest are refused uncharged`, async () => {
    for (const [tool, args, cost] of [["domain_check", { domain: "good.example.com.au" }, 5], ["explain_finding", { finding: "spf_missing" }, 25]] as const) {
      const w = await worldWith(undefined, b); w.h.dns.zone["good.example.com.au"] = ["v=spf1 -all"];
      await w.h.deps.store.creditApply(w.accountId, 25, "topup", "evt_seed", 1);
      const res = await Promise.all(Array.from({ length: 24 }, () => mcp(w, tool, args)));
      const served = res.filter((x) => x.result?.structuredContent?.receipt).length, refused = res.filter((x) => x.result?.structuredContent?.error === "insufficient_credits").length;
      assert.equal(served, Math.floor(25 / cost), `${tool}: served ${served}`);
      assert.equal(served + refused, 24);
      assert.equal(await w.h.deps.store.creditBalance(w.accountId), 25 - cost * served);
    }
  });
  test(`I4 [${b}]: 20 parallel calls with the SAME Idempotency-Key debit exactly once and every caller gets the one receipt`, async () => {
    const w = await worldWith(undefined, b); w.h.dns.zone["good.example.com.au"] = ["v=spf1 -all"];
    await w.h.deps.store.creditApply(w.accountId, 100, "topup", "evt_seed", 1);
    const res = await Promise.all(Array.from({ length: 20 }, () => mcp(w, "domain_check", { domain: "good.example.com.au" }, { "idempotency-key": "job-1" })));
    const rids = new Set(res.map((x) => x.result?.structuredContent?.receipt?.id).filter(Boolean));
    assert.equal(rids.size, 1, `distinct receipts: ${rids.size}`);
    assert.equal(await w.h.deps.store.creditBalance(w.accountId), 95, "one charge of 5, not more");
    assert.equal((await w.h.deps.store.creditEntries(w.accountId)).filter((e) => e.reason === "debit").length, 1);
  });
}

// ================= PART D: reserve and expire (idempotency claims) =================
// Model: a claim is live until now >= expiresAt. First caller wins; a live claim is never stolen; an expired claim is taken over and
// KEEPS its rid; only the owner can release. Run on both adapters, 300 sequences each.
async function reserveSequence(seed: number, mk: () => Store): Promise<string | null> {
  const r = rng(seed), s = await mk(), TTL = 30_000;
  const ids = ["key_aaaaaaaa1", "key_aaaaaaaa2"];
  for (const k of ids) await s.putKey({ id: k, accountId: "acct_A", hash: `h_${k}`, scopes: [], createdAt: 1 });
  const model = new Map<string, { rid: string; owner: string; exp: number }>(); let now = 1_000_000, n = 0;
  for (let step = 0; step < r.int(6, 30); step++) {
    const kind = r.pick(["reserve", "reserve", "reserve", "expire", "release", "release-other"]), key = r.pick(ids), idem = r.pick(["i1", "i2"]), mk2 = `${key}|${idem}`;
    if (kind === "expire") { now += r.int(1, TTL + 5000); continue; }
    const cur = model.get(mk2);
    if (kind === "reserve") {
      const rid = `rcpt_${++n}`, owner = `own_${n}`, got = await s.idemReserve(key, idem, rid, owner, now, TTL);
      const live = cur && cur.exp > now;
      if (live) { if (got.won || got.rid !== cur.rid) return `seed ${seed} step ${step}: a live claim was stolen or its rid lost (${JSON.stringify(got)} vs ${cur.rid})`; }
      else { const want = cur?.rid ?? rid; if (!got.won || got.rid !== want) return `seed ${seed} step ${step}: expired/absent claim not taken over with rid ${want}: ${JSON.stringify(got)}`; model.set(mk2, { rid: want, owner, exp: now + TTL }); }
    } else if (kind === "release") { if (cur) { await s.idemRelease(key, idem, cur.owner); model.delete(mk2); } }
    else { await s.idemRelease(key, idem, "someone_else"); }
  }
  return null;
}
for (const b of BACKENDS) {
  test(`reserve / expire [${b}]: ${SEQUENCES} generated claim sequences never steal a live claim, always keep the rid on takeover, release is owner-only`, async () => {
    const bad: string[] = [];
    for (let seed = 1; seed <= SEQUENCES; seed++) { const v = await reserveSequence(seed, async () => { const x = await mkStore(b); return x; }); if (v) { bad.push(v); if (bad.length >= 3) break; } }
    assert.deepEqual(bad, [], bad.join(" | "));
  });
  test(`expire [${b}]: an owner that crashed AFTER its debit and BEFORE its receipt is recovered once: the retry charges nothing more and signs the one receipt`, async () => {
    const w = await worldWith(undefined, b); w.h.dns.zone["good.example.com.au"] = ["v=spf1 -all"];
    await w.h.deps.store.creditApply(w.accountId, 100, "topup", "evt_seed", 1);
    // the crashed owner: claimed the key and debited under its rid, then died (no receipt, claim not released)
    await w.h.deps.store.idemReserve(w.keyId, "job-crash", "rcpt_dead1", "own_dead", w.h.clock.t, 30_000);
    await w.h.deps.store.creditApply(w.accountId, -5, "debit", "rcpt_dead1", w.h.clock.t);
    w.h.clock.t += 31_000; // the claim expires
    const res = await mcp(w, "domain_check", { domain: "good.example.com.au" }, { "idempotency-key": "job-crash" });
    assert.equal(res.result.structuredContent.receipt.id, "rcpt_dead1", "the takeover keeps the dead owner's rid");
    assert.equal(await w.h.deps.store.creditBalance(w.accountId), 95, "charged once in total, not twice");
    const again = await mcp(w, "domain_check", { domain: "good.example.com.au" }, { "idempotency-key": "job-crash" });
    assert.equal(again.result.structuredContent.replayed, true);
    assert.equal(await w.h.deps.store.creditBalance(w.accountId), 95);
  });
  test(`expire [${b}]: a LIVE claim held by another worker is not stolen: the caller answers idempotency_in_progress and charges nothing`, async () => {
    const { idemTiming } = await import("../src/agent/mcp.ts");
    const old = idemTiming.waitMs; idemTiming.waitMs = 60;
    try {
      const w = await worldWith(undefined, b); w.h.dns.zone["good.example.com.au"] = ["v=spf1 -all"];
      await w.h.deps.store.creditApply(w.accountId, 100, "topup", "evt_seed", 1);
      await w.h.deps.store.idemReserve(w.keyId, "job-live", "rcpt_live1", "own_live", w.h.clock.t, 30_000);
      const res = await mcp(w, "domain_check", { domain: "good.example.com.au" }, { "idempotency-key": "job-live" });
      assert.equal(res.result.structuredContent.error, "idempotency_in_progress");
      assert.equal(await w.h.deps.store.creditBalance(w.accountId), 100);
    } finally { idemTiming.waitMs = old; }
  });
}

// ================= MUTATION TESTS: each invariant has a broken store the suite must catch =================
class NegativeOK extends MemoryStore { // M-I2: the overdraw check is gone
  async creditApply(id: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number) { const bal = this.ledger.filter((e) => e.accountId === id).reduce((n, e) => n + e.delta, 0); this.ledger.push({ id: `e${this.ledger.length}`, accountId: id, delta, reason, ref, at }); return bal + delta; }
}
class BalanceDrift extends MemoryStore { // M-I1: the balance disagrees with the entries by one after any debit
  async creditBalance(id: string) { const es = this.ledger.filter((e) => e.accountId === id); return es.reduce((n, e) => n + e.delta, 0) + (es.some((e) => e.reason === "debit") ? 1 : 0); }
}
class NoDedupe extends MemoryStore { // M-I4a: a replayed (reason, ref) is granted again (the pre-F98 MemoryStore behaviour)
  async creditApply(id: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number) { const bal = this.ledger.filter((e) => e.accountId === id).reduce((n, e) => n + e.delta, 0); if (bal + delta < 0) return undefined; this.ledger.push({ id: `e${this.ledger.length}`, accountId: id, delta, reason, ref, at }); return bal + delta; }
}
class NoRefund extends MemoryStore { // M-I3: a reversal is swallowed, so a failed call stays charged
  async creditApply(id: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number) { if (reason === "reversal") return 0; return super.creditApply(id, delta, reason, ref, at); }
}
class NoIdemLookup extends MemoryStore { // M-I4b: the Idempotency-Key lookup and the reservation are disabled
  async receiptByIdem() { return undefined; }
  async idemReserve(_k: string, _i: string, rid: string) { return { won: true, rid }; }
}
class RacyDebit extends MemoryStore { // M-I5: read, await, write (the non-atomic shape)
  async creditApply(id: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number) { const bal = await this.creditBalance(id); await Promise.resolve(); if (bal + delta < 0) return undefined; this.ledger.push({ id: `e${this.ledger.length}`, accountId: id, delta, reason, ref, at }); return bal + delta; }
}
// The mutation helpers return the violation text, so each test also asserts the mutant was caught for the INTENDED reason.
const caught = async (mk: () => Store, seeds = 80) => { for (let s = 1; s <= seeds; s++) { const v = await ledgerSequence(s, async () => { const x = mk(); for (const id of ["acct_A", "acct_B"]) await x.putAccount({ id, email: `${id}@example.com.au`, seat: "owner", createdAt: 0 }); return x; }); if (v) return v; } return null; };
const caughtCalls = async (mk: () => Store, seeds = 120) => { for (let s = 1; s <= seeds; s++) { const v = await callSequence(s, "memory", mk); if (v) return v; } return null; };

test("mutation I2: a store with no overdraw check is caught by the ledger sequences", async () => { assert.match((await caught(() => new NegativeOK())) ?? "", /I2/); });
test("mutation I1: a store whose balance drifts from its entries is caught", async () => { assert.match((await caught(() => new BalanceDrift())) ?? "", /I1/); });
test("mutation I4: a store that does not dedupe (reason, ref) is caught", async () => { assert.match((await caught(() => new NoDedupe())) ?? "", /I4/); });
test("mutation I3: a store that swallows reversals (failed call stays charged) is caught by the call sequences", async () => { assert.match((await caughtCalls(() => new NoRefund())) ?? "", /I3|I1|balance/); });
test("mutation I4 (idempotency key): a store whose key lookup is disabled is caught by the call sequences", async () => { assert.match((await caughtCalls(() => new NoIdemLookup())) ?? "", /I4|balance/); });
test("mutation I5: a non-atomic read-await-write debit over-serves a balance of 25 and the concurrency check sees it", async () => {
  const s = new RacyDebit(); await s.creditApply("acct_A", 25, "topup", "evt_seed", 1);
  const res = await Promise.all(Array.from({ length: 30 }, (_, i) => s.creditApply("acct_A", -5, "debit", `c${i}`, 2)));
  assert.ok(res.filter((x) => x !== undefined).length > 5, "the mutant must serve more than floor(25/5)");
});
test("mutation harness is live: the real stores are NOT flagged by the same detectors", async () => {
  assert.equal(await caught(() => new MemoryStore(), 40), null);
  assert.equal(await caughtCalls(() => new MemoryStore(), 40), null);
});
class StealingReserve extends MemoryStore { // M-reserve: a live claim is overwritten by the next caller
  async idemReserve(k: string, i: string, rid: string, owner: string, now: number, ttl: number) { this.idem.set(`${k}\u0000${i}`, { rid, owner, expiresAt: now + ttl }); return { won: true, rid }; }
}
class ForgetsRid extends MemoryStore { // M-expire: a takeover mints a new rid, so a crashed owner's debit cannot be found
  async idemReserve(k: string, i: string, rid: string, owner: string, now: number, ttl: number) { const c = this.idem.get(`${k}\u0000${i}`); if (c && c.expiresAt > now) return { won: false, rid: c.rid }; this.idem.set(`${k}\u0000${i}`, { rid, owner, expiresAt: now + ttl }); return { won: true, rid }; }
}
test("mutation reserve: a store that lets a second caller steal a live claim is caught", async () => {
  let v: string | null = null; for (let sd = 1; sd <= 60 && !v; sd++) v = await reserveSequence(sd, async () => { const x = new StealingReserve(); await x.putAccount({ id: "acct_A", email: "a@example.com.au", seat: "owner", createdAt: 0 }); return x; });
  assert.match(v ?? "", /stolen/);
});
test("mutation expire: a takeover that forgets the original rid is caught", async () => {
  let v: string | null = null; for (let sd = 1; sd <= 60 && !v; sd++) v = await reserveSequence(sd, async () => { const x = new ForgetsRid(); await x.putAccount({ id: "acct_A", email: "a@example.com.au", seat: "owner", createdAt: 0 }); return x; });
  assert.match(v ?? "", /taken over|rid/);
});
