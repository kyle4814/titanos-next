// f29: market read-path latency vs job count, isolated from every other store (SYNTHETIC jobs). Usage: node --experimental-strip-types scale.ts [reps]
// Seeds N jobs (24 owners, 10 pros, mixed statuses) straight into MemoryMarketStore, then times the five market read paths over HTTP.
import { rig } from "../../test/market_harness.ts";
const REPS = Number(process.argv[2] ?? 200); const SIZES = [130, 250, 500, 1000];
let s = 31; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const STAT = ["open", "open", "awaiting_funds", "claimed", "delivered", "paid", "paid", "reproved", "cancelled"] as const;
const q = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return +b[Math.min(b.length - 1, Math.floor(b.length * p))]!.toFixed(3); };
const out: any[] = [];
for (const N of SIZES) {
  const r = rig(); const owners = [], pros = [];
  for (let i = 0; i < 24; i++) owners.push(await r.owner(`o${i}@own.example.com`, `own${i}.example.com.au`));
  for (let i = 0; i < 10; i++) pros.push(await r.pro(`p${i}@pro.example.com`));
  for (let i = 0; i < N; i++) {
    const o = pick(owners), st = pick([...STAT]), pro = st === "open" || st === "awaiting_funds" || st === "cancelled" ? undefined : pick(pros).account.id;
    await r.store.putJob({ id: "j" + i, ownerAccountId: o.account.id, domainId: o.domainId, domain: o.domain, check: pick(["SPF", "DMARC", "DKIM"]), severity: pick(["FAIL", "WARN"]), tier: "small", priceCents: 4900, claimFeeCents: 490, status: st, createdAt: 1000 + i, updatedAt: 1000 + i, baseline: { at: 1, status: "WARN", detail: "" }, proAccountId: pro, abandonedBy: rnd() < 0.2 ? [pick(pros).account.id] : [], rescans: 0, warrantyChecks: 0, events: [],
      proof: st === "paid" || st === "reproved" ? { scanId: "s", at: 1, baseline: "WARN", now: "PASS", detail: "" } : undefined } as any);
  }
  const lat: number[] = []; const per: Record<string, number[]> = {};
  for (let k = 0; k < REPS; k++) {
    const o = pick(owners), p = pick(pros);
    for (const [path, tok] of [["/pro/board", p.session], ["/market/jobs", o.session], ["/pro/rank", p.session], ["/pro/payouts", p.session], ["/market/leaderboard", ""]] as const) {
      const t0 = performance.now(); const res = await r.h.req("GET", path, tok ? { token: tok } : {}); { const dt = performance.now() - t0; lat.push(dt); (per[path] ??= []).push(dt); } if (res.status !== 200) throw new Error(path + " " + res.status);
    }
  }
  out.push({ jobs: N, calls: lat.length, p50: q(lat, 0.5), p99: q(lat, 0.99), perPathP99: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, q(v, 0.99)])) });
}
console.log(JSON.stringify(out));
