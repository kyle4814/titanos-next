// C8 f335: MUTATION CHECK for the KV size (liveSize) code. Each mutant is applied to a TEMP COPY of portal-api and
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
  { name: "S1 list prefix drops the tenant", from: "const prefix = `estate:v1:${tenant}:`;", to: "const prefix = `estate:v1:`;" },
  { name: "S2 foreign-name prefix check removed", from: ' || !n.startsWith(prefix)) continue;', to: ') continue;' },
  { name: "S3 bare-hash check removed", from: "if (!/^[0-9a-f]{32}$/.test(rest)) continue;", to: "" },
  { name: "S4 list throw reports 0", from: "limit: page }); } catch { return \"unknown\"; }", to: "limit: page }); } catch { return 0; }" },
  { name: "S5 cap check removed", from: 'if (names.size > cap) return "unknown";', to: "" },
  { name: "S6 no list reports 0", from: 'typeof o.kv.list !== "function") return "unknown";', to: 'typeof o.kv.list !== "function") return 0;' },
  { name: "S7 cursor never followed", from: "cursor = r.cursor;", to: "" },
  { name: "S8 expired entries counted as live", from: "(so.includeStale || now() < e.exp)", to: "true" },
  { name: "S9 includeStale ignored", from: "(so.includeStale || now() < e.exp)", to: "now() < e.exp" },
  { name: "S10 sync stats size reports 0", from: 'size: "unknown" as KvSize', to: "size: 0 as KvSize" },
  { name: "S11 get error while counting is skipped", from: 'if (e === "ERR") return "unknown";\n          if (e &&', to: "if (e &&" },
  { name: "S12 cursor stall guard removed", from: 'if (!r.cursor || r.cursor === cursor) return "unknown";', to: 'if (!r.cursor) return "unknown";' },
  { name: "S13 tenant validation skipped in liveSize", from: "if (!validTenant(tenant) || typeof o.kv.list", to: "if (typeof o.kv.list" },
  { name: "S14 incomplete page treated as complete", from: "if (r.list_complete) {", to: "if (true) {" },
  { name: "S15 page limit not passed to list", from: "limit: page }); }", to: "}); }" },
  { name: "S16 invalid/foreign values counted by name only", from: "if (e && (so.includeStale", to: "if ((e || true) && (so.includeStale" },
];
function runOn(m: (typeof MUTANTS)[number]): Promise<{ caught: boolean; applied: boolean; tail: string }> {
  const dir = mkdtempSync(join(tmpdir(), "f335_mut_"));
  if (!dir || dir === "/" || !dir.includes("f335_mut_")) throw new Error("unsafe temp dir");
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
