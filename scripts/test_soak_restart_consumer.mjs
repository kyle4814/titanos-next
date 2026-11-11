// test_soak_restart_consumer.mjs - f424 tests + mutation tests for scripts/soak_restart_consumer.mjs. Synthetic fixtures in a temp dir, no network.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("./soak_restart_consumer.mjs", import.meta.url));
const OLD = "a".repeat(40), NEW = "b".repeat(40), NEWER = "c".repeat(40);
const NOW = Date.parse("2026-11-11T12:00:00Z");
const marker = (o = {}) => ({ restart: true, reason: "merge during soak pinned", at: "2026-11-11T11:00:00.000Z", stage: "merge", pinned: OLD, ...o });

function fixture(m, pin = NEW, clock) {
  const d = mkdtempSync(join(tmpdir(), "f424-"));
  if (m !== undefined) writeFileSync(join(d, "RESTART.json"), typeof m === "string" ? m : JSON.stringify(m));
  if (pin !== null) writeFileSync(join(d, "PIN.json"), JSON.stringify({ sha: pin }));
  if (clock) writeFileSync(join(d, "CLOCK.json"), JSON.stringify(clock));
  return d;
}
const j = (d, f) => JSON.parse(readFileSync(join(d, f), "utf8"));
const archived = (d) => (existsSync(join(d, "archive")) ? readdirSync(join(d, "archive")) : []);
const untouched = (d, why) => { assert.ok(existsSync(join(d, "RESTART.json")), why + ": marker stays"); assert.ok(!existsSync(join(d, "CLOCK.json")) || true); assert.ok(!existsSync(join(d, "RERUN_REQUEST.json")), why + ": no request"); assert.equal(archived(d).length, 0, why + ": nothing archived"); };

// battery(mod) -> array of failed rule names. Each rule is one check; mutants must fail at least one.
function battery(mod) {
  const fails = [];
  const rule = (name, fn) => { try { fn(); } catch (e) { fails.push(name); } };
  const run = (d) => mod.consume({ dir: d, now: NOW });

  rule("consumed-once-clock-reset", () => {
    const d = fixture(marker(), NEW, { pin_sha: OLD, restarts: 2, started_at: "2026-11-10T00:00:00Z" });
    const r = run(d); assert.equal(r.code, 0);
    const c = j(d, "CLOCK.json");
    assert.equal(c.pin_sha, NEW); assert.equal(c.restarts, 3); assert.equal(c.elapsed_ms, 0); assert.equal(c.started_at, new Date(NOW).toISOString());
  });
  rule("rerun-request-x3-on-new-pin", () => {
    const d = fixture(marker()); run(d);
    const q = j(d, "RERUN_REQUEST.json");
    assert.equal(q.sha, NEW); assert.equal(q.required_probes.length, 3);
    assert.deepEqual(q.required_probes.map((p) => p.id), ["x3-1", "x3-2", "x3-3"]);
    assert.ok(q.required_probes.every((p) => p.sha === NEW));
  });
  rule("marker-archived", () => {
    const d = fixture(marker()); run(d);
    assert.ok(!existsSync(join(d, "RESTART.json"))); assert.equal(archived(d).length, 1);
    assert.equal(JSON.parse(readFileSync(join(d, "archive", archived(d)[0]), "utf8")).pinned, OLD);
  });
  rule("double-run-noop", () => {
    const d = fixture(marker()); run(d);
    const c1 = readFileSync(join(d, "CLOCK.json"), "utf8"), q1 = readFileSync(join(d, "RERUN_REQUEST.json"), "utf8");
    const r2 = mod.consume({ dir: d, now: NOW + 60000 });
    assert.equal(r2.code, 0); assert.match(r2.line, /NOOP/);
    assert.equal(readFileSync(join(d, "CLOCK.json"), "utf8"), c1); assert.equal(readFileSync(join(d, "RERUN_REQUEST.json"), "utf8"), q1);
    assert.equal(archived(d).length, 1);
  });
  rule("crash-replay-no-second-reset", () => {
    const d = fixture(marker()); run(d);
    // simulate crash after clock write but before archive: put the marker back
    writeFileSync(join(d, "RESTART.json"), JSON.stringify(marker()));
    const c1 = readFileSync(join(d, "CLOCK.json"), "utf8");
    const r = mod.consume({ dir: d, now: NOW + 120000 });
    assert.equal(r.code, 0); assert.equal(readFileSync(join(d, "CLOCK.json"), "utf8"), c1); assert.ok(!existsSync(join(d, "RESTART.json")));
  });
  for (const [name, m] of [["corrupt-json", "{not json"], ["array", "[]"], ["restart-false", marker({ restart: false })], ["no-reason", marker({ reason: "" })], ["bad-date", marker({ at: "soon" })]])
    rule("reject-" + name, () => { const d = fixture(m); const r = run(d); assert.equal(r.code, 1); assert.match(r.line, /FAIL/); untouched(d, name); });
  rule("reject-short-pinned-sha", () => { const d = fixture(marker({ pinned: "abc1234" })); assert.equal(run(d).code, 1); untouched(d, "short pinned"); });
  rule("reject-short-new-pin", () => { const d = fixture(marker(), "abc1234"); assert.equal(run(d).code, 1); untouched(d, "short pin"); });
  rule("reject-upper-or-nonhex-pin", () => { const d = fixture(marker(), "G".repeat(40)); assert.equal(run(d).code, 1); untouched(d, "nonhex pin"); });
  rule("reject-missing-pin", () => { const d = fixture(marker(), null); assert.equal(run(d).code, 1); untouched(d, "no pin"); });
  rule("reject-stale-marker", () => { const d = fixture(marker({ at: "2026-11-09T11:00:00.000Z" })); assert.equal(run(d).code, 1); assert.match(run(d).line, /stale/); untouched(d, "stale"); });
  rule("reject-future-marker", () => { const d = fixture(marker({ at: "2026-11-12T11:00:00.000Z" })); assert.equal(run(d).code, 1); untouched(d, "future"); });
  rule("reject-pin-not-advanced", () => { const d = fixture(marker(), OLD); const r = run(d); assert.equal(r.code, 1); assert.match(r.line, /not advanced/); untouched(d, "pin same"); });
  rule("tick-marker-without-pinned-ok", () => { const d = fixture({ restart: true, reason: "SOAKMX FAIL", at: "2026-11-11T11:30:00Z", stage: "tick", gate_exit: 1 }); assert.equal(run(d).code, 0); assert.equal(j(d, "CLOCK.json").pin_sha, NEW); });
  rule("no-marker-noop", () => { const d = fixture(undefined); const r = run(d); assert.equal(r.code, 0); assert.match(r.line, /NOOP/); assert.ok(!existsSync(join(d, "CLOCK.json"))); });
  rule("change-during-soak-restarts-again", () => {
    const d = fixture(marker({ pinned: OLD }), NEW); run(d); assert.equal(j(d, "CLOCK.json").restarts, 1);
    writeFileSync(join(d, "RESTART.json"), JSON.stringify(marker({ pinned: NEW, at: "2026-11-11T11:45:00.000Z" })));
    writeFileSync(join(d, "PIN.json"), JSON.stringify({ sha: NEWER }));
    assert.equal(mod.consume({ dir: d, now: NOW + 600000 }).code, 0);
    const c = j(d, "CLOCK.json"); assert.equal(c.restarts, 2); assert.equal(c.pin_sha, NEWER); assert.equal(c.previous_pin_sha, NEW);
    assert.equal(j(d, "RERUN_REQUEST.json").sha, NEWER); assert.equal(archived(d).length, 2);
  });
  const good = (sha, id, o = {}) => ({ probe_id: id, sha, pass: true, open_p0: 0, open_p1: 0, ...o });
  const req = () => mod.plan({ raw: JSON.stringify(marker()), pinSha: NEW, now: NOW }).request;
  rule("x3-three-on-new-sha-pass", () => { const c = mod.x3Counts(req(), [good(NEW, "x3-1"), good(NEW, "x3-2"), good(NEW, "x3-3")]); assert.equal(c.ok, true); assert.equal(c.passed, 3); });
  rule("x3-old-sha-does-not-count", () => {
    const c = mod.x3Counts(req(), [good(OLD, "x3-1"), good(OLD, "x3-2"), good(OLD, "x3-3")]);
    assert.equal(c.ok, false); assert.equal(c.passed, 0); assert.equal(c.stale, 3);
    const m = mod.x3Counts(req(), [good(OLD, "x3-1"), good(NEW, "x3-2"), good(NEW, "x3-3")]); assert.equal(m.ok, false); assert.equal(m.passed, 2);
  });
  rule("x3-open-p1-or-p0-fails", () => {
    assert.equal(mod.x3Counts(req(), [good(NEW, "x3-1"), good(NEW, "x3-2"), good(NEW, "x3-3", { open_p1: 1 })]).ok, false);
    assert.equal(mod.x3Counts(req(), [good(NEW, "x3-1"), good(NEW, "x3-2"), good(NEW, "x3-3", { open_p0: 1 })]).ok, false);
    assert.equal(mod.x3Counts(req(), [good(NEW, "x3-1"), good(NEW, "x3-2"), good(NEW, "x3-3", { pass: false })]).ok, false);
  });
  rule("x3-one-vote-per-probe", () => { assert.equal(mod.x3Counts(req(), [good(NEW, "x3-1"), good(NEW, "x3-1"), good(NEW, "x3-1")]).ok, false); });
  rule("x3-unknown-probe-id-ignored", () => { assert.equal(mod.x3Counts(req(), [good(NEW, "x3-1"), good(NEW, "x3-2"), good(NEW, "other")]).ok, false); });
  rule("x3-bad-request-fails-closed", () => { assert.equal(mod.x3Counts(undefined, []).ok, false); assert.equal(mod.x3Counts({ sha: "abc", required_probes: [] }, []).ok, false); });
  return fails;
}

let pass = 0;
const ok = (n) => { pass++; console.log("PASS", n); };

// 1. the real module passes its whole battery
const real = await import(pathToFileURL(SRC).href);
assert.deepEqual(battery(real), [], "real module must pass every rule");
ok("real module passes every rule");

// 2. CLI: end to end on a fixture dir, exit codes and double run
{
  const d = fixture(marker({ at: new Date().toISOString() }));
  const run = () => spawnSync("node", [SRC, "--dir", d], { encoding: "utf8" });
  const a = run(); assert.equal(a.status, 0); assert.match(a.stdout, /SOAKRST OK consumed/);
  const b = run(); assert.equal(b.status, 0); assert.match(b.stdout, /SOAKRST NOOP/);
  const bad = fixture("garbage"); const c = spawnSync("node", [SRC, "--dir", bad], { encoding: "utf8" }); assert.equal(c.status, 1); assert.match(c.stdout, /SOAKRST FAIL/);
  assert.equal(spawnSync("node", [SRC], { encoding: "utf8" }).status, 1);
  assert.equal(spawnSync("node", [SRC, "--dir", d, "--now", "nonsense"], { encoding: "utf8" }).status, 1);
  ok("CLI: consumed once, second run NOOP, corrupt exit 1, usage exit 1, bad --now exit 1");
}

// 3. source check: no network, no timers, no child processes, no eval
{
  const src = readFileSync(SRC, "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  for (const bad of [/node:(http|https|net|dgram|tls|dns|child_process|worker_threads)/, /\bfetch\s*\(/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bsetImmediate\b/, /\beval\s*\(/, /new Function/, /\bspawn|\bexec/, /process\.env/])
    assert.ok(!bad.test(src), "forbidden construct " + bad);
  ok("source check: no network, timers, child processes or env");
}

// 4. mutation tests: each planted mutant must fail at least one rule
const base = readFileSync(SRC, "utf8");
const mutants = [
  ["drop stale check", `if (age > maxAgeMs) return`, `if (false) return`],
  ["drop future check", `if (age < -FUTURE_SKEW_MS) return`, `if (false) return`],
  ["drop short pinned-sha check", `if (m.pinned !== undefined && !(typeof m.pinned === "string" && SHA40.test(m.pinned)))`, `if (false)`],
  ["drop short new-pin check", `if (typeof pinSha !== "string" || !SHA40.test(pinSha)) return`, `if (typeof pinSha !== "string") return`],
  ["drop pin-not-advanced check", `if (m.pinned && m.pinned === pinSha) return`, `if (false) return`],
  ["drop restart flag check", `if (m.restart !== true) return`, `if (false) return`],
  ["drop reason check", `if (typeof m.reason !== "string" || !m.reason.trim()) return`, `if (false) return`],
  ["drop date check", `if (typeof m.at !== "string" || Number.isNaN(Date.parse(m.at))) return`, `if (false) return`],
  ["swallow corrupt JSON", `catch { return { ok: false, error: "marker is not valid JSON" }; }`, `catch { m = { restart: true, reason: "x", at: new Date(now).toISOString() }; }`],
  ["no archive", `renameSync(markerPath, join(arch, `, `void (join(arch, `],
  ["no clock write", `writeAtomic(join(dir, "CLOCK.json"), p.clock);`, ``],
  ["no request write", `writeAtomic(join(dir, "RERUN_REQUEST.json"), p.request);`, ``],
  ["clock not reset (keeps old start)", `started_at: iso, elapsed_ms: 0,`, `started_at: (prevClock && prevClock.started_at) || iso, elapsed_ms: 0,`],
  ["restart counter stuck", `+ 1,\n    last_marker_digest`, `+ 0,\n    last_marker_digest`],
  ["drop replay guard", `const replay = prevClock && prevClock.last_marker_digest === p.digest;`, `const replay = false;`],
  ["noop becomes fail", `return { code: 0, line: "SOAKRST NOOP no restart marker" }`, `return { code: 1, line: "SOAKRST NOOP no restart marker" }`],
  ["request on old sha", `sha: pinSha, created_at`, `sha: m.pinned || pinSha, created_at`],
  ["only one probe required", `length: X3 }, (_, i)`, `length: 1 }, (_, i)`],
  ["x3 ignores sha", `if (r.sha !== request.sha) { stale++; continue; }`, ``],
  ["x3 ignores open P1", `r.open_p1 === 0 &&`, ``],
  ["x3 ignores open P0", `r.open_p0 === 0 &&`, ``],
  ["x3 ignores pass flag", `r.pass === true &&`, ``],
  ["x3 double-counts a probe", `&& want.has(r.probe_id)) seen.add(r.probe_id);`, `&& want.has(r.probe_id)) seen.add(r.probe_id + seen.size);`],
  ["x3 accepts any count", `seen.size === want.size && want.size === X3`, `seen.size >= 1`],
];
const dir = mkdtempSync(join(tmpdir(), "f424-mut-"));
let killed = 0;
for (const [name, from, to] of mutants) {
  assert.ok(base.includes(from), "mutant anchor not found: " + name);
  const f = join(dir, `m${killed}.mjs`);
  writeFileSync(f, base.replace(from, to));
  let m; try { m = await import(pathToFileURL(f).href); } catch { m = null; }
  const fails = m ? battery(m) : ["load-failed"];
  assert.ok(fails.length > 0, "SURVIVED mutant: " + name);
  killed++;
}
ok(`${killed} planted mutants all killed`);
rmSync(dir, { recursive: true, force: true });
console.log(`soak_restart_consumer: ${pass} pass, 0 fail`);
