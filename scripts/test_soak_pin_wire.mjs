// Tests for soak_pin_wire.mjs + its wiring in soak_harness.mjs and merge_base_red_precheck.mjs. SYNTHETIC fixtures, temp dir + temp git repo, localhost only.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const S = (n) => fileURLToPath(new URL("./" + n, import.meta.url));
const WIRE = S("soak_pin_wire.mjs");
const A = "a".repeat(40), B = "b".repeat(40);
const d = mkdtempSync(join(tmpdir(), "spw-"));
if (!d.startsWith(tmpdir())) throw new Error("bad tmp");
const w = (n, o) => { const p = join(d, n); writeFileSync(p, typeof o === "string" ? o : JSON.stringify(o)); return p; };
const marker = join(d, "state", "soak", "RESTART.json");
const clear = () => rmSync(join(d, "state"), { recursive: true, force: true });
const x3 = (sha, i, extra = {}) => w(`X3_${i}.json`, { sha, verdict: "CLEAN", x3_open_p0p1: 0, ...extra });
const node = (script, args) => { const r = spawnSync("node", [script, ...args], { encoding: "utf8" }); return { code: r.status, out: (r.stdout + r.stderr).trim() }; };
const tickArgs = (o = {}) => {
  const xs = o.x3 === null ? [] : (o.x3 ?? [A, A, A]).map((s, i) => x3(s, i + 1, o.extra?.[i] ?? {}));
  return ["tick", "--matrix", w("m.json", { head: o.mh ?? A }), "--pin", o.noPin ? join(d, "none.json") : w("pin.json", { sha: o.ps ?? A }),
    ...xs.flatMap((x) => ["--x3", x]), "--head", o.head ?? A, "--marker", marker];
};
const tick = (name, o, code, word, wantMarker) => {
  clear(); const r = node(WIRE, tickArgs(o));
  const m = existsSync(marker) ? JSON.parse(readFileSync(marker, "utf8")) : null;
  ok(r.code === code && r.out.includes(word) && (wantMarker ? m && m.restart === true : !m), `${name} -> exit ${code} ${word}, marker=${wantMarker} [${r.out.slice(0, 80)}]`);
};

tick("clean pin + x3 same sha passes", {}, 0, "SOAKMX PASS", false);
tick("pin mismatch fails closed", { ps: B }, 1, "SOAKWIRE RESTART", true);
tick("matrix head mismatch fails closed", { mh: B }, 1, "SOAKWIRE RESTART", true);
tick("x3 receipts missing entirely", { x3: null }, 1, "SOAKWIRE RESTART", true);
tick("x3 partial (2 of 3)", { x3: [A, A] }, 1, "SOAKWIRE RESTART", true);
tick("x3 on stale sha", { x3: [A, B, A] }, 1, "SOAKWIRE RESTART", true);
tick("open P1", { extra: [{}, { x3_open_p0p1: 1 }, {}] }, 1, "1 open P0/P1", true);
tick("open P0", { extra: [{ x3_open_p0p1: 2 }, {}, {}] }, 1, "open P0/P1", true);
tick("post-pin merge (head moved)", { head: B }, 1, "SOAKMX RESTART", true);
tick("pin file missing", { noPin: true }, 1, "SOAKWIRE RESTART", true);
{ clear(); const r = node(WIRE, ["tick", "--marker", marker]); ok(r.code === 1 && existsSync(marker) && JSON.parse(readFileSync(marker, "utf8")).restart === true, "no args at all fails closed with machine-readable marker"); }
{ clear(); const r = node(WIRE, ["nonsense"]); ok(r.code === 1, "unknown mode fails closed"); }

// merge (pre-merge) mode
const mg = (name, pinPath, extra, code, word, wantMarker) => {
  clear(); const r = node(WIRE, ["merge", "--pin", pinPath, "--repo", d, "--marker", marker, ...extra]);
  ok(r.code === code && r.out.includes(word) && existsSync(marker) === wantMarker, `${name} -> exit ${code} ${word} marker=${wantMarker}`);
};
mg("merge, no soak running", join(d, "absent.json"), [], 0, "no soak running", false);
mg("merge during live soak refused", w("pin.json", { sha: A }), [], 1, "restarts it", true);
mg("merge during live soak, accept-restart", w("pin.json", { sha: A }), ["--accept-restart"], 0, "RESTART accepted", true);
mg("merge, corrupt pin fails closed even with accept", w("bad.json", "{nope"), ["--accept-restart"], 1, "MERGE FAIL", true);
mg("merge, short sha pin fails closed", w("short.json", { sha: "abc" }), ["--accept-restart"], 1, "MERGE FAIL", true);

// the f397 gate is really invoked: an alternate "gate" that always passes proves wiring is by delegation, and a gate that prints PASS with exit 1 still fails
{
  const { tickGate } = await import("./soak_pin_wire.mjs");
  clear();
  const fake1 = w("g1.mjs", 'console.log("SOAKMX PASS");process.exit(1)');
  ok(tickGate({ matrix: "", pin: "", head: A, marker, gate: fake1 }).code === 1, "PASS text with non-zero exit is not a pass");
  const fake2 = w("g2.mjs", 'console.log("something else");process.exit(0)');
  ok(tickGate({ matrix: "", pin: "", head: A, marker, gate: fake2 }).code === 1, "exit 0 without PASS text is not a pass");
  const fake3 = w("g3.mjs", 'console.log("SOAKMX PASS");process.exit(0)');
  clear(); ok(tickGate({ matrix: "", pin: "", head: A, marker, gate: fake3 }).code === 0 && !existsSync(marker), "gate PASS + exit 0 passes, no marker");
}

// real temp git repo: pin, then a new commit lands = RESTART through the real --repo/--ref path
{
  const g = (...a) => spawnSync("git", ["-C", join(d, "repo"), ...a], { encoding: "utf8" });
  mkdirSync(join(d, "repo")); g("init", "-q", "-b", "main"); g("config", "user.email", "t@t"); g("config", "user.name", "t");
  writeFileSync(join(d, "repo", "f"), "1"); g("add", "."); g("commit", "-qm", "one");
  const sha1 = g("rev-parse", "HEAD").stdout.trim();
  const args = (sha) => ["tick", "--matrix", w("m2.json", { head: sha }), "--pin", w("p2.json", { sha }),
    ...[1, 2, 3].flatMap((i) => ["--x3", x3(sha, "g" + i)]), "--repo", join(d, "repo"), "--ref", "main", "--marker", marker];
  clear(); let r = node(WIRE, args(sha1)); ok(r.code === 0 && r.out.includes("PASS"), "real git head == pin passes");
  writeFileSync(join(d, "repo", "f"), "2"); g("commit", "-qam", "two");
  clear(); r = node(WIRE, args(sha1)); ok(r.code === 1 && existsSync(marker), "real git: commit merged after pin restarts the soak");
}

// source wiring: harness and merge precheck really call the wire; planted mutants of the wiring are caught by this same check
const harness = readFileSync(S("soak_harness.mjs"), "utf8"), pre = readFileSync(S("merge_base_red_precheck.mjs"), "utf8");
const wire = readFileSync(WIRE, "utf8");
const wired = (h, p, wi) => /pinGate\(\);\n\s*const result = await runSoak/.test(h) && /for \(const s of extra\) s\.close\(\);\n\s*await pinGate\(\)/.test(h)
  && /r\.code !== 0\) \{[^}]*process\.exit\(1\)/.test(h) && /soak_pin_wire\.mjs/.test(h)
  && /--soak-pin/.test(p) && /g\.code !== 0\) process\.exit\(1\)/.test(p)
  && /spawnSync\("node", args/.test(wi) && /r\.status === 0 && \/\\bPASS\\b\/\.test\(line\)/.test(wi) && /code: 1, line: `SOAKWIRE RESTART/.test(wi);
ok(wired(harness, pre, wire), "wiring present in harness (pre-run + post-run), merge precheck and wire");
const mut = (name, h, p, wi) => ok(!wired(h, p, wi), "mutant caught: " + name);
mut("drop pre-run gate", harness.replace(/await pinGate\(\);\n  const result/, "const result"), pre, wire);
mut("drop post-run gate", harness.replace(/await pinGate\(\);\n  const out/, "const out"), pre, wire);
mut("harness ignores gate exit", harness.replace(/process\.exit\(1\); \}\n  \};/, "}\n  };"), pre, wire);
mut("merge precheck ignores verdict", harness, pre.replace("if (g.code !== 0) process.exit(1);", ""), wire);
mut("wire accepts exit 0 alone", harness, pre, wire.replace("r.status === 0 && /\\bPASS\\b/.test(line)", "r.status === 0"));
mut("wire returns 0 on failure", harness, pre, wire.replace("return { code: 1, line: `SOAKWIRE RESTART", "return { code: 0, line: `SOAKWIRE RESTART"));
mut("wire drops the gate call", harness, pre, wire.replace('spawnSync("node", args', 'spawnSync("true", args'));

rmSync(d, { recursive: true, force: true });
console.log(`soak_pin_wire: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
