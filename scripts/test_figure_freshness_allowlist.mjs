// Gate for the figure_freshness allowlist (f390, chunk C9 second verifier). Kill test: the live tree exits 0 only because
// every ORPHAN is a kernel-repo path named in scripts/figure_freshness_allowlist.json with a reason and an EXACT cap, and every
// STALE figure is classified per file with an exact cap. A planted ORPHAN, a planted STALE, a cap raised by 1, a cap lowered
// by 1, a reasonless entry, a path missing from the kernel, and a no-source figure each make the run fail.
// Fixtures are synthetic and live in a temp folder; the as-of date is fixed so the test never drifts.
// It shares no test file with scripts/test_figure_freshness.mjs (the primary C9 test is scripts/test_c9proof.mjs).
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const ASOF = "2026-11-07";
const HERE = fileURLToPath(new URL(".", import.meta.url));
const CLI = join(HERE, "figure_freshness.mjs");
const REAL_ALLOW = join(HERE, "figure_freshness_allowlist.json");
// Ratchet constants: measured 2026-11-10 when the allowlist was written. They may only be LOWERED in a later commit.
const MAX_PATH_CAP_SUM = 67, MAX_STALE_CAP_SUM = 131;

const tmp = mkdtempSync(join(tmpdir(), "figfreshal-"));
if (!tmp || !existsSync(tmp) || !tmp.includes("figfreshal-")) { console.log("FAIL no safe temp dir"); process.exit(1); }
const put = (root, rel, body) => { const f = join(root, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, typeof body === "string" ? body : JSON.stringify(body, null, 1)); };
const day = (n) => new Date(Date.UTC(2026, 10, 7) - n * 86400000).toISOString().slice(0, 10);
const run = (args) => spawnSync("node", [CLI, "--as-of", ASOF, ...args], { encoding: "utf8" });

// ---- fixture repo: trust.json adapter, one figure per case ---------------------------------------------
const K = join(tmp, "kernel"); put(K, "bin/tool.py", "x"); put(K, "state/data.json", "{}");
function repo(name, sections, asOf = day(3)) {
  const R = join(tmp, name);
  put(R, "docs/real.md", "x");
  put(R, "lib/site-data/trust.json", { asOf, system: "Synthetic test system", sections });
  return R;
}
const AL = (paths, stale = []) => ({ paths, stale, total_cap: paths.reduce((s, e) => s + e.cap, 0) });
const PATH = (path, cap = 1) => ({ path, cap, reason: "Synthetic kernel-owned source used only by this test fixture." });
const alFile = (name, obj) => { const f = join(tmp, name); writeFileSync(f, JSON.stringify(obj)); return f; };
const go = (R, al, extra = []) => run(["--root", R, "--allowlist", alFile("al-" + Math.random().toString(36).slice(2) + ".json", al), "--kernel", K, ...extra]);

// 1. a clean fixture passes; a kernel-only source is ALLOWED and listed, not hidden
let R = repo("r1", [{ id: "a", source: "docs/real.md" }, { id: "k", source: "bin/tool.py" }]);
let p = go(R, AL([PATH("bin/tool.py")]));
ok(p.status === 0, "kernel-only source with a capped reason passes");
ok(/ALLOWED 1/.test(p.stdout) && /every path verified present/.test(p.stdout), "the allowed figure is counted and the path is verified in the kernel");

// 2. planted ORPHAN: a missing path not on the allowlist fails
R = repo("r2", [{ id: "a", source: "docs/real.md" }, { id: "k", source: "bin/tool.py" }, { id: "bad", source: "docs/not_there.md" }]);
p = go(R, AL([PATH("bin/tool.py")]));
ok(p.status === 1 && /FAIL ORPHAN .*#sections\.bad/.test(p.stdout), "planted ORPHAN (path on no allowlist) fails");

// 3. planted STALE: day 31 with no classified entry fails; day 30 passes
R = repo("r3", [{ id: "a", source: "docs/real.md" }], day(31));
p = go(R, AL([PATH("bin/tool.py")]));
ok(p.status === 1 && /no classified entry/.test(p.stdout), "planted STALE (day 31, unclassified file) fails");
R = repo("r3b", [{ id: "a", source: "docs/real.md" }], day(30));
ok(go(R, AL([])).status === 0, "day 30 is FRESH and passes");
R = repo("r3c", [{ id: "a", source: "docs/real.md" }], day(31));
ok(go(R, AL([], [{ file: "lib/site-data/trust.json", cap: 1, reason: "Synthetic stale figure classified for this fixture." }])).status === 0, "STALE classified with an exact cap passes");

// 4. mutations: cap +1 and cap -1 (orphan path and stale), total_cap drift
R = repo("r4", [{ id: "k", source: "bin/tool.py" }], day(31));
const good = AL([PATH("bin/tool.py")], [{ file: "lib/site-data/trust.json", cap: 1, reason: "Synthetic stale figure classified for this fixture." }]);
ok(go(R, good).status === 0, "baseline fixture with exact caps passes");
let m = structuredClone(good); m.paths[0].cap = 2; m.total_cap = 2;
p = go(R, m); ok(p.status === 1 && /lower cap 2 to 1/.test(p.stdout), "MUTATION path cap +1 fails (cap can only fall)");
m = structuredClone(good); m.stale[0].cap = 2;
p = go(R, m); ok(p.status === 1 && /lower cap 2 to 1/.test(p.stdout), "MUTATION stale cap +1 fails");
R = repo("r4b", [{ id: "k", source: "bin/tool.py" }, { id: "k2", source: "bin/tool.py" }]);
p = go(R, AL([PATH("bin/tool.py", 1)]));
ok(p.status === 1 && /cap is 1/.test(p.stdout), "MUTATION cap -1 (a new figure uses the path) fails");
m = structuredClone(good); m.total_cap = 5;
ok(go(repo("r4c", [{ id: "k", source: "bin/tool.py" }], day(31)), m).status === 1, "MUTATION total_cap drift fails");

// 5. entry hygiene
m = structuredClone(good); m.paths[0].reason = "";
ok(go(repo("r5", [{ id: "k", source: "bin/tool.py" }], day(31)), m).status === 1, "entry with no reason fails");
m = structuredClone(good); m.paths[0].path = "bin/missing_from_kernel.py";
p = go(repo("r5b", [{ id: "k", source: "bin/missing_from_kernel.py" }], day(31)), m);
ok(p.status === 1 && /allowlist rot/.test(p.stdout), "allowlisted path absent from the kernel checkout fails (allowlist rot)");
m = structuredClone(good); m.paths.push(PATH("bin/tool.py"));
ok(go(repo("r5c", [{ id: "k", source: "bin/tool.py" }], day(31)), m).status === 1, "duplicate entry fails");

// 6. a figure with no source or no checkable path can never be allowed, even beside an allowlisted path
R = repo("r6", [{ id: "nosrc" }, { id: "k", source: "bin/tool.py" }]);
p = go(R, AL([PATH("bin/tool.py")]));
ok(p.status === 1 && /FAIL ORPHAN .*#sections\.nosrc/.test(p.stdout), "figure with no source fails even with an allowlist");

// 7. the live tree: exits 0, the real caps are exact, and the ratchet constants hold
const real = JSON.parse(readFileSync(REAL_ALLOW, "utf8"));
const rl = spawnSync("node", [CLI, "--as-of", "2026-11-10"], { encoding: "utf8", cwd: join(HERE, "..") });
ok(rl.status === 0 && /PASS no UNDATED, ORPHAN or NOSYSTEM/.test(rl.stdout), "live tree: node scripts/figure_freshness.mjs exits 0");
const sum = real.paths.reduce((s, e) => s + e.cap, 0), ssum = real.stale.reduce((s, e) => s + e.cap, 0);
ok(real.total_cap === sum && sum <= MAX_PATH_CAP_SUM, `live path caps sum ${sum} <= ratchet ${MAX_PATH_CAP_SUM} and equal total_cap`);
ok(ssum <= MAX_STALE_CAP_SUM, `live stale caps sum ${ssum} <= ratchet ${MAX_STALE_CAP_SUM}`);
ok(real.paths.every((e) => e.reason.length >= 20 && !/[–—]/.test(e.reason)), "every live entry carries a reason, no dashes");
if (existsSync("/home/tech2/klinge-kernel")) {
  const live = structuredClone(real); live.paths[0].cap += 1; live.total_cap += 1;
  const mp = spawnSync("node", [CLI, "--as-of", "2026-11-10", "--allowlist", alFile("live-mut.json", live)], { encoding: "utf8", cwd: join(HERE, "..") });
  ok(mp.status === 1, "MUTATION on the live allowlist (first cap +1) fails");
  const live2 = structuredClone(real); live2.paths.pop(); live2.total_cap = live2.paths.reduce((s, e) => s + e.cap, 0);
  const mq = spawnSync("node", [CLI, "--as-of", "2026-11-10", "--allowlist", alFile("live-mut2.json", live2)], { encoding: "utf8", cwd: join(HERE, "..") });
  ok(mq.status === 1, "MUTATION on the live allowlist (an entry removed) fails: the ORPHANs reappear");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
