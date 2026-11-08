// f310: MUTATION CHECK for the estate cache wiring. Each mutant is applied to a TEMP COPY of portal-api (+ lib) and
// test/estate_wire.test.ts is run against it; the suite must FAIL. The live tree is never touched. SYNTHETIC, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SVC = "src/enterprise/service.ts", CACHE = "src/enterprise/estate_cache.ts", ROUTES = "src/enterprise/routes.ts", LIM = "src/enterprise/estate_refresh.ts";
const MUTANTS: { name: string; file: string; from: string; to: string }[] = [
  { name: "W1 cache key drops tenantId", file: CACHE, from: "`${tenant}\\u0000${domain.trim().toLowerCase()}`", to: "`${domain.trim().toLowerCase()}`" },
  { name: "W2 refresh limit ignored", file: SVC, from: "c.refreshLimiter && await c.refreshLimiter.allow(tid)", to: "true" },
  { name: "W3 refresh query param ignored", file: ROUTES, from: 'get("refresh") === "1"', to: 'get("refresh") === "never"' },
  { name: "W4 stale marker dropped", file: SVC, from: "{ cacheOnly: true }); stale = true; }", to: "{ cacheOnly: true }); }" },
  { name: "W5 over-limit path calls the resolver", file: SVC, from: "forTenant(tid, { cacheOnly: true })", to: "forTenant(tid, { refresh: true })" },
  { name: "W6 cacheOnly ignored by the cache", file: CACHE, from: "if (opts.cacheOnly) {", to: "if (false) {" },
  { name: "W7 estate bypasses the cache (bare provider)", file: SVC, from: "else scan = c.estateCache.forTenant(tid);", to: "else scan = c.scan;" },
  { name: "W8 no limiter wired fails open", file: SVC, from: "if (opts.refresh && c.refreshLimiter && ", to: "if (opts.refresh && (!c.refreshLimiter || true) && " },
  { name: "W9 limiter shared across tenants (key ignores tenant)", file: LIM, from: 'throttleKey("estate-refresh", tenantId)', to: 'throttleKey("estate-refresh", "all")' },
  { name: "W10 refresh does not repopulate (plain view after refresh pays again)", file: CACHE, from: "put(k, a); return a;\n      } catch", to: "return a;\n      } catch" },
];
function runOn(m: (typeof MUTANTS)[number]): Promise<{ caught: boolean; applied: boolean; tail: string }> {
  const dir = mkdtempSync(join(tmpdir(), "f310_mut_"));
  if (!dir || dir === "/" || !dir.includes("f310_mut_")) throw new Error("unsafe temp dir");
  cpSync(join(root, "src"), join(dir, "portal-api/src"), { recursive: true });
  cpSync(join(root, "test"), join(dir, "portal-api/test"), { recursive: true });
  cpSync(join(root, "../lib"), join(dir, "lib"), { recursive: true });
  const f = join(dir, "portal-api", m.file), src = readFileSync(f, "utf8");
  const applied = src.includes(m.from);
  writeFileSync(f, src.replace(m.from, m.to));
  return new Promise((res) => {
    let out = "";
    const p = spawn(process.execPath, ["--test", "--experimental-strip-types", "test/estate_wire.test.ts"], { cwd: join(dir, "portal-api"), stdio: ["ignore", "pipe", "pipe"], env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("NODE_TEST"))) });
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => { rmSync(dir, { recursive: true, force: true }); res({ caught: code !== 0, applied, tail: code === 0 ? out.slice(-200) : out.split("\n").filter((l) => /^not ok/.test(l)).slice(0, 2).join(" | ") }); });
  });
}
test("every mutant of the estate cache wiring is applied and CAUGHT", async () => {
  const results = await Promise.all(MUTANTS.map(runOn));
  let caught = 0;
  for (const [i, r] of results.entries()) {
    console.log(`ESTWIRE MUTANT ${r.caught ? "CAUGHT" : "SURVIVED"} ${MUTANTS[i].name} :: ${r.tail}`);
    assert.ok(r.applied, `${MUTANTS[i].name}: the patch did not apply (source changed shape)`);
    assert.ok(r.caught, `${MUTANTS[i].name} SURVIVED`);
    caught++;
  }
  console.log(`ESTWIRE MUTANTS caught=${caught}/${MUTANTS.length}`);
});
