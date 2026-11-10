// C8 f321: MUTATION CHECK for the KV estate adapters. Each mutant is applied to a TEMP COPY of portal-api and
// test/estate_kv.test.ts is run against it; the suite must FAIL. The live tree is never touched. SYNTHETIC, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KV = "src/enterprise/estate_kv.ts";
const MUTANTS: { name: string; from: string; to: string }[] = [
  { name: "K1 cache key drops the tenant prefix", from: "`estate:v1:${tenant}:${dh}`", to: "`estate:v1:${dh}`" },
  { name: "K2 read skips the tenant-binding check", from: "v.t !== tenant || ", to: "" },
  { name: "K3 read skips the schema check", from: " || !validAssessment(v.a)", to: "" },
  { name: "K4 KV read error fails open (miss, fresh scan)", from: 'catch { return "ERR"; }', to: "catch { return null; }" },
  { name: "K5 logical TTL ignored", from: "if (e && !opts.refresh && now() < e.exp)", to: "if (e && !opts.refresh)" },
  { name: "K6 cache put drops expirationTtl", from: "{ expirationTtl: ttlSec(life + grace) }", to: "{}" },
  { name: "K7 shared limiter key across tenants", from: "`estate-refresh:v1:${tenantId}`", to: "`estate-refresh:v1:all`" },
  { name: "K8 limiter fails open on KV read error", from: "try { raw = await this.kv.get(key); } catch { return false; }", to: "try { raw = await this.kv.get(key); } catch { raw = null; }" },
  { name: "K9 tenant id validation disabled", from: "const TENANT_RX = /^[A-Za-z0-9_-]{1,64}$/;", to: "const TENANT_RX = /^[\\s\\S]*$/;" },
  { name: "K10 limiter allows on a corrupt value", from: "v.count < 0) return false;", to: "v.count < 0) return true;" },
  { name: "K11 limiter window never resets", from: "if (t < v.windowStart + this.windowMs) {", to: "if (true) {" },
  { name: "K12 limiter skips the foreign-tenant check", from: "v.t !== tenantId || ", to: "" },
  { name: "K13 ESTATE_KV ignored (always Memory)", from: "if (env.ESTATE_KV) return", to: "if (false) return" },
  { name: "K14 stale grace dropped from KV lifetime", from: "ttlSec(life + grace)", to: "ttlSec(life)" },
  { name: "K15 domain not normalised", from: "const domainOf = (d: string) => d.trim().toLowerCase();", to: "const domainOf = (d: string) => d;" },
  { name: "K16 limiter put drops expirationTtl", from: "{ expirationTtl: ttlSec(windowStart + this.windowMs - t) }", to: "{}" },
  { name: "K17 in-flight de-dupe removed", from: "if (pending) return pending;", to: "" },
  { name: "K18 cacheOnly ignored", from: "if (opts.cacheOnly) {", to: "if (false) {" },
];
function runOn(m: (typeof MUTANTS)[number]): Promise<{ caught: boolean; applied: boolean; tail: string }> {
  const dir = mkdtempSync(join(tmpdir(), "f321_mut_"));
  if (!dir || dir === "/" || !dir.includes("f321_mut_")) throw new Error("unsafe temp dir");
  cpSync(join(root, "src"), join(dir, "portal-api/src"), { recursive: true });
  cpSync(join(root, "test"), join(dir, "portal-api/test"), { recursive: true });
  const f = join(dir, "portal-api", KV), src = readFileSync(f, "utf8");
  const applied = src.includes(m.from);
  writeFileSync(f, src.replace(m.from, m.to));
  return new Promise((res) => {
    let out = "";
    const p = spawn(process.execPath, ["--test", "--experimental-strip-types", "test/estate_kv.test.ts"], { cwd: join(dir, "portal-api"), stdio: ["ignore", "pipe", "pipe"], env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("NODE_TEST"))) });
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => { rmSync(dir, { recursive: true, force: true }); res({ caught: code !== 0, applied, tail: code === 0 ? out.slice(-200) : out.split("\n").filter((l) => /^not ok/.test(l)).slice(0, 2).join(" | ") }); });
  });
}
test("baseline passes (the mutants are measured against a green suite)", async () => {
  const r = await runOn({ name: "baseline", from: "\u0000nope", to: "" }); assert.equal(r.caught, false, r.tail);
});
for (const m of MUTANTS) {
  test(`mutant killed: ${m.name}`, async () => {
    const r = await runOn(m);
    assert.ok(r.applied, `mutation anchor not found: ${m.name}`);
    assert.ok(r.caught, `SURVIVED: ${m.name} ${r.tail}`);
  });
}
