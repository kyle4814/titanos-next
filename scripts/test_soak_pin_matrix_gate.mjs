// Tests for soak_pin_matrix_gate.mjs. SYNTHETIC fixtures only (fake shas, temp dir, temp git repo). No live traffic.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const GATE = fileURLToPath(new URL("./soak_pin_matrix_gate.mjs", import.meta.url));
const A = "a".repeat(40), B = "b".repeat(40);
const d = mkdtempSync(join(tmpdir(), "spmg-"));
if (!d.startsWith(tmpdir())) throw new Error("bad tmp");
const w = (n, o) => { const p = join(d, n); writeFileSync(p, typeof o === "string" ? o : JSON.stringify(o)); return p; };
const x3 = (sha, i, extra = {}) => w(`X3_${i}.json`, { sha, verdict: "CLEAN", x3_open_p0p1: 0, ...extra });
const run = (args) => { const r = spawnSync("node", [GATE, ...args], { encoding: "utf8" }); return { code: r.status, out: r.stdout.trim() }; };
const base = (o = {}) => {
  const m = w("m.json", { head: o.mh ?? A }), p = w("pin.json", { sha: o.ps ?? A });
  const xs = (o.xs ?? [A, A, A]).map((s, i) => x3(s, i + 1, o.extra?.[i] ?? {}));
  return ["--matrix", m, "--pin", p, ...xs.flatMap((x) => ["--x3", x]), "--head", o.head ?? A];
};
const t = (name, args, code, word) => { const r = run(args); ok(r.code === code && r.out.includes(word), `${name} -> ${code} ${word} [${r.out.slice(0, 90)}]`); return r; };

t("all agree, head unchanged", base(), 0, "SOAKMX PASS");
t("head moved after pin is RESTART not PASS", base({ head: B }), 3, "SOAKMX RESTART");
t("planted: matrix head differs", base({ mh: B }), 1, "matrix head");
t("planted: pin differs from matrix", base({ ps: B }), 1, "!= pin");
t("planted: one x3 probe on a different sha", base({ xs: [A, B, A] }), 1, "names bbbbbbbbb");
t("planted: all x3 on old sha, matrix+pin new", base({ mh: B, ps: B, head: B, xs: [A, A, A] }), 1, "names aaaaaaaaa");
t("only two probes", base({ xs: [A, A] }), 1, "only 2 x3 probe");
t("open P1 blocks", base({ extra: [{}, { x3_open_p0p1: 1 }, {}] }), 1, "1 open P0/P1");
t("null open count is not clean", base({ extra: [{ x3_open_p0p1: null }, {}, {}] }), 1, "did not complete");
t("string open count rejected", base({ extra: [{ x3_open_p0p1: "0" }, {}, {}] }), 1, "did not complete");
t("verdict not CLEAN", base({ extra: [{ verdict: "FAILED" }, {}, {}] }), 1, "not CLEAN");
t("short sha rejected", base({ mh: "aaaa", ps: "aaaa", head: "aaaa", xs: ["aaaa", "aaaa", "aaaa"] }), 1, "40-hex");
// mismatch beats restart: stale artifacts must FAIL, not look like a mere restart
t("mismatch + moved head still FAIL", base({ mh: B, head: B }), 1, "matrix head");
// probes array form
{
  const m = w("m2.json", { head: A }), p = w("p2.json", { sha: A });
  const f = w("X3_multi.json", { sha: A, probes: [{ id: "p1", sha: A, open_p0p1: 0 }, { id: "p2", sha: A, open_p0p1: 0 }, { id: "p3", sha: A, open_p0p1: 0 }] });
  t("probes array of 3 passes", ["--matrix", m, "--pin", p, "--x3", f, "--head", A], 0, "PASS");
  const f2 = w("X3_multi2.json", { sha: A, probes: [{ id: "p1", sha: A, open_p0p1: 0 }, { id: "p1", sha: A, open_p0p1: 0 }, { id: "p3", sha: A, open_p0p1: 0 }] });
  t("duplicate probe id rejected", ["--matrix", m, "--pin", p, "--x3", f2, "--head", A], 1, "duplicate");
  const f3 = w("X3_multi3.json", { sha: A, probes: [{ id: "p1", sha: A, open_p0p1: 0 }, { id: "p2", sha: B, open_p0p1: 0 }, { id: "p3", sha: A, open_p0p1: 0 }] });
  t("one probe in array on other sha rejected", ["--matrix", m, "--pin", p, "--x3", f3, "--head", A], 1, "names bbbbbbbbb");
}
// input errors
t("missing matrix file", ["--matrix", join(d, "nope.json"), "--pin", w("pp.json", { sha: A }), "--x3", x3(A, 9), "--head", A], 4, "ERROR");
t("malformed pin", ["--matrix", w("mm.json", { head: A }), "--pin", w("bad.json", "{oops"), "--x3", x3(A, 9), "--head", A], 4, "not valid JSON");
t("no x3 given", ["--matrix", w("mm2.json", { head: A }), "--pin", w("pp2.json", { sha: A }), "--head", A], 4, "need --matrix");
t("min-probes cannot be lowered", [...base(), "--min-probes", "1"], 4, "cannot go below 3");
t("no head source", base().slice(0, -2), 4, "need --head");
// git-resolved head
{
  const g = (...a) => spawnSync("git", ["-C", join(d, "repo"), ...a], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", join(d, "repo")]);
  g("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "one");
  const h1 = g("rev-parse", "HEAD").stdout.trim();
  const args = (sha) => ["--matrix", w("gm.json", { head: sha }), "--pin", w("gp.json", { sha }), ...[1, 2, 3].flatMap((i) => ["--x3", x3(sha, 20 + i)]), "--repo", join(d, "repo"), "--ref", "HEAD"];
  t("repo head equals pin passes", args(h1), 0, "PASS");
  g("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "two");
  t("new commit after pin -> RESTART", args(h1), 3, "RESTART");
  t("unresolvable ref", [...args(h1).slice(0, -2), "--ref", "nope"], 4, "cannot resolve");
}
// read-only: no file in the temp dir changed by the gate
{
  const hash = () => createHash("sha256").update(readdirSync(d).filter((f) => f !== "repo").sort().map((f) => f + readFileSync(join(d, f), "utf8")).join("|")).digest("hex");
  const h0 = hash(); run(base()); ok(hash() === h0, "gate writes nothing");
}
// mutation tests: flip one comparison in a copy of the gate, the suite's key cases must catch each
{
  const src = readFileSync(GATE, "utf8");
  const muts = [
    ["drop matrix==pin", "if (mh !== ps) return", "if (false) return"],
    ["drop probe sha compare", "if (p.sha !== ps) return", "if (false) return"],
    ["drop open>0 block", "if (p.open > 0) return", "if (false) return"],
    ["restart becomes pass", "if (head !== ps) return { code: 3,", "if (false) return { code: 3,"],
    ["drop min probes", "if (probes.length < minProbes) return", "if (false) return"],
    ["drop completed-int check", "!Number.isInteger(p.open) || p.open < 0", "false"],
  ];
  const cases = [base({ mh: B }), base({ ps: B }), base({ xs: [A, B, A] }), base({ extra: [{}, { x3_open_p0p1: 1 }, {}] }), base({ head: B }), base({ xs: [A, A] }), base({ extra: [{ x3_open_p0p1: null }, {}, {}] })];
  const expect = [1, 1, 1, 1, 3, 1, 1];
  for (const [name, from, to] of muts) {
    ok(src.includes(from), `mutant anchor present: ${name}`);
    const mp = join(d, "mut.mjs"); writeFileSync(mp, src.replace(from, to));
    const survived = cases.every((c, i) => spawnSync("node", [mp, ...c], { encoding: "utf8" }).status === expect[i]);
    ok(!survived, `mutant killed: ${name}`);
  }
}
rmSync(d, { recursive: true, force: true });
console.log(`soak_pin_matrix_gate: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
