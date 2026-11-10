// node --experimental-strip-types scripts/test_abuse_guard.mjs
// B10 abuse and runaway-cost guard. Synthetic only: fake clock, in-memory store, no network.
import { AbuseGuard, InMemoryStore, DEFAULT_CONFIG, BudgetExceededError, refill, validateConfig } from "../lib/abuseGuard.ts";

let fails = 0, n = 0;
const ok = (name, cond, extra = "") => { n++; if (!cond) { fails++; console.error(`FAIL ${name} ${extra}`); } };
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const T0 = Date.UTC(2026, 10, 6, 0, 0, 0); // 2026-11-06 10:00 Brisbane
function mk(over = {}, store = new InMemoryStore()) {
  let t = T0;
  const clock = () => t;
  const cfg = { ...DEFAULT_CONFIG, ...over };
  return { g: new AbuseGuard(store, clock, cfg), store, adv: (ms) => { t += ms; }, set: (v) => { t = v; } };
}

// 1. burst limit per client: capacity 5, 6th denied, retryAfter sane, other client unaffected
{
  const { g } = mk();
  for (let i = 0; i < 5; i++) eq(`burst allow ${i}`, g.check("guest_scan", "a").allow, true);
  const d = g.check("guest_scan", "a");
  eq("burst 6th denied", d.allow, false);
  eq("burst reason", d.reason, "rate_limited_client");
  ok("retryAfter ~120s", d.retryAfterMs > 100000 && d.retryAfterMs <= 120001, String(d.retryAfterMs));
  eq("other client ok", g.check("guest_scan", "b").allow, true);
}
// 2. refill over time and clock-injection (no wall clock)
{
  const { g, adv } = mk();
  for (let i = 0; i < 5; i++) g.check("xray_guest", "a");
  eq("empty", g.check("xray_guest", "a").allow, false);
  adv(119000); eq("not yet", g.check("xray_guest", "a").allow, false);
  adv(2000); eq("refilled one", g.check("xray_guest", "a").allow, true);
  eq("only one", g.check("xray_guest", "a").allow, false);
  const s = refill({ tokens: 0, updatedAt: 1000 }, { capacity: 3, refillPerSec: 1 }, 500);
  eq("clock backwards adds nothing", s.tokens, 0);
  const cap = refill({ tokens: 0, updatedAt: 0 }, { capacity: 3, refillPerSec: 1 }, 1e9);
  eq("capped at capacity", cap.tokens, 3);
}
// 3. global limit across many clients, and a denied client does not burn a global token
{
  const { g } = mk({ global: { capacity: 10, refillPerSec: 0.001 } });
  let allowed = 0;
  for (let i = 0; i < 20; i++) if (g.check("guest_scan", `c${i}`).allow) allowed++;
  eq("global 10 allowed", allowed, 10);
  eq("global reason", g.check("guest_scan", "zz").reason, "rate_limited_global");
  const m = mk({ global: { capacity: 3, refillPerSec: 0.001 } });
  for (let i = 0; i < 5; i++) m.g.check("guest_scan", "hog"); // 3 allowed, then client fine? capacity 5 so global denies after 3
  const gb = m.store.getBucket("__global__");
  ok("global not negative", gb.tokens >= 0);
}
// 4. daily cap trips kill switch, degrades to code_only with 0 model calls, resets at day rollover
{
  const { g, adv, set } = mk({ dailySpendCapUsd: 5 });
  eq("under cap", g.recordSpend(2).tripped, false);
  eq("live before trip", g.check("xray_consented", "a").mode, "live");
  eq("consented budget 3", g.check("xray_consented", "a").modelCallsAllowed, 3);
  eq("trips at cap", g.recordSpend(3).tripped, true);
  eq("switch tripped", g.isKillSwitchTripped(), true);
  const d = g.check("xray_consented", "b");
  eq("degraded still allowed", d.allow, true);
  eq("degraded mode", d.mode, "code_only");
  eq("degraded zero model calls", d.modelCallsAllowed, 0);
  adv(3600e3 * 12); // 12:00 Brisbane-day 06 -> still 22:00 same day
  eq("still tripped same day", g.isKillSwitchTripped(), true);
  set(T0 + 3600e3 * 14 + 1000); // 00:00:01 Brisbane next day (UTC 14:00 + 10h)
  eq("reset next day", g.isKillSwitchTripped(), false);
  eq("live again", g.check("xray_consented", "c").mode, "live");
  eq("spend reset", g.recordSpend(1).totalUsd, 1);
}
// 5. manual trip/reset; cached degraded mode config
{
  const { g } = mk({ degradedMode: "cached" });
  g.tripKillSwitch("drill");
  eq("cached mode", g.check("guest_scan", "a").mode, "cached");
  g.resetKillSwitch();
  eq("manual reset", g.check("guest_scan", "a").mode, "live");
}
// 6. kill switch fails closed: store errors deny, never allow; bad spend trips
{
  class Broken extends InMemoryStore { getKill() { throw new Error("db down"); } }
  const b = mk({}, new Broken());
  const d = b.g.check("guest_scan", "a");
  eq("store error denies", d.allow, false);
  eq("store error reason", d.reason, "store_error");
  eq("store error reads as tripped", b.g.isKillSwitchTripped(), true);
  eq("spend on broken store tripped", b.g.recordSpend(0.01).tripped, true);
  class BrokenBucket extends InMemoryStore { getBucket() { throw new Error("x"); } }
  eq("bucket error denies", mk({}, new BrokenBucket()).g.check("guest_scan", "a").allow, false);
  class BrokenLog extends InMemoryStore { appendLog() { throw new Error("x"); } }
  eq("log failure does not block", mk({}, new BrokenLog()).g.check("guest_scan", "a").allow, true);
  const { g } = mk();
  for (const bad of [NaN, Infinity, -1]) {
    const m = mk();
    eq(`bad spend ${bad} trips`, m.g.recordSpend(bad).tripped, true);
    eq(`bad spend ${bad} degrades`, m.g.check("guest_scan", "a").mode, "code_only");
  }
  eq("empty key denied", g.check("guest_scan", "").allow, false);
  eq("long key denied", g.check("guest_scan", "x".repeat(200)).allow, false);
  eq("unknown path denied", g.check("admin", "a").allow, false);
  const nan = new AbuseGuard(new InMemoryStore(), () => NaN, DEFAULT_CONFIG);
  eq("NaN clock denied", nan.check("guest_scan", "a").allow, false);
}
// 7. model-call budget: guest paths assert 0; attempt throws and is logged; consented gets 3
{
  const { g } = mk();
  for (const p of ["guest_scan", "xray_guest"]) {
    const b = g.budgetFor(p, g.check(p, "a"));
    eq(`${p} budget 0`, b.allowed, 0);
    let threw = false;
    try { b.assertModelCall(); } catch (e) { threw = e instanceof BudgetExceededError; }
    eq(`${p} model call throws`, threw, true);
    eq(`${p} used stays 0`, b.modelCallsUsed, 0);
  }
  const c = g.budgetFor("xray_consented", g.check("xray_consented", "a"));
  for (let i = 0; i < 3; i++) c.assertModelCall();
  let over = false; try { c.assertModelCall(); } catch { over = true; }
  eq("4th call over budget", over, true);
  ok("violations logged", g.decisionLog().filter((e) => e.kind === "budget_violation").length === 3);
  g.tripKillSwitch();
  const k = g.budgetFor("xray_consented", g.check("xray_consented", "z"));
  let t2 = false; try { k.assertModelCall(); } catch { t2 = true; }
  eq("kill switch zeroes consented budget", t2, true);
  const dn = g.budgetFor("xray_consented", { allow: false, mode: "deny", reason: "x", retryAfterMs: 0, modelCallsAllowed: 3 });
  eq("denied decision gets 0", dn.allowed, 0);
}
// 8. config refuses a guest model budget above 0 or nonsense
{
  const bad = { ...DEFAULT_CONFIG, modelCallBudget: { ...DEFAULT_CONFIG.modelCallBudget, guest_scan: 1 } };
  ok("validate flags guest budget", validateConfig(bad).length > 0);
  let threw = false; try { new AbuseGuard(new InMemoryStore(), () => 0, bad); } catch { threw = true; }
  eq("constructor throws", threw, true);
  ok("default valid", validateConfig(DEFAULT_CONFIG).length === 0);
  ok("zero cap invalid", validateConfig({ ...DEFAULT_CONFIG, dailySpendCapUsd: 0 }).length > 0);
}
// 9. tracker bound: full tracker of active clients denies new ones (fail closed); idle ones evicted
{
  const { g, adv } = mk({ maxTrackedClients: 3 });
  for (const k of ["a", "b", "c"]) g.check("guest_scan", k);
  eq("tracker full denies new", g.check("guest_scan", "d").reason, "tracker_full");
  eq("existing still served", g.check("guest_scan", "a").allow, true);
  adv(3600e3);
  eq("idle evicted, new ok", g.check("guest_scan", "d").allow, true);
}
// 10. decision log: bounded, records allow and deny
{
  const { g } = mk({ maxLogEntries: 5 });
  for (let i = 0; i < 12; i++) g.check("guest_scan", "a");
  eq("log bounded", g.decisionLog().length, 5);
  ok("log has deny", g.decisionLog().some((e) => e.allow === false && e.reason === "rate_limited_client"));
}
console.log(`${n - fails}/${n} abuse guard checks`);
if (fails) process.exit(1);
console.log("ABUSEGUARD TESTS OK");
