// Tests for the export manifest digest in the soak pin (f431, C10). SYNTHETIC fixtures in a temp dir, localhost only, read-only on the repo.
// Documented rule: the digest is sha256 of the manifest FILE BYTES. So an added page, a removed page and a reordered-but-same-set file all change
// the bytes and ALL restart the soak (exit 3, the word f424 consumes). A pin that carries no digest fails (exit 1). Missing/unparsable manifest = exit 4.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const S = (n) => fileURLToPath(new URL("./" + n, import.meta.url));
const GATE = S("soak_pin_matrix_gate.mjs"), WIRE = S("soak_pin_wire.mjs");
const A = "a".repeat(40);
const d = mkdtempSync(join(tmpdir(), "spm-"));
if (!d.startsWith(tmpdir())) throw new Error("bad tmp");
const w = (n, o) => { const p = join(d, n); writeFileSync(p, typeof o === "string" ? o : JSON.stringify(o)); return p; };
const node = (script, args) => { const r = spawnSync("node", [script, ...args], { encoding: "utf8" }); return { code: r.status, out: (r.stdout + r.stderr).trim() }; };
const man = (routes) => JSON.stringify({ routes_count: routes.length, routes }, null, 2) + "\n";
const sha = (t) => createHash("sha256").update(t).digest("hex");
const x3 = [1, 2, 3].map((i) => w(`X3_${i}.json`, { sha: A, verdict: "CLEAN", x3_open_p0p1: 0 }));
const matrix = w("m.json", { head: A });
const base = ["/", "/a", "/b"];
const mpath = join(d, "export_pages.json");
const gate = (pinObj, extra = [], script = GATE) => node(script, ["--matrix", matrix, "--pin", w("pin.json", pinObj), ...x3.flatMap((x) => ["--x3", x]), "--head", A, "--manifest", mpath, ...extra]);
const t0 = man(base);
writeFileSync(mpath, t0);
const pin0 = { sha: A, manifest_sha256: sha(t0), routes_count: 3 };

let r = gate(pin0); ok(r.code === 0 && r.out.includes("PASS"), `unchanged manifest keeps the pin [${r.out.slice(0, 60)}]`);
writeFileSync(mpath, man([...base, "/c"]));
r = gate(pin0); ok(r.code === 3 && r.out.includes("RESTART") && r.out.includes("routes 3 -> 4"), `one added page = pin change, RESTART exit 3 [${r.out.slice(0, 70)}]`);
writeFileSync(mpath, man(["/", "/a"]));
r = gate(pin0); ok(r.code === 3 && r.out.includes("routes 3 -> 2"), "one removed page = pin change, RESTART exit 3");
writeFileSync(mpath, man(["/b", "/a", "/"]));
r = gate(pin0); ok(r.code === 3 && r.out.includes("routes 3 -> 3"), "reordered-but-same-set file = different bytes = RESTART (byte-digest rule, documented)");
writeFileSync(mpath, t0 + " ");
r = gate(pin0); ok(r.code === 3, "whitespace-only byte change = RESTART (digest is over bytes, not parsed content)");
writeFileSync(mpath, t0);
r = gate({ sha: A }); ok(r.code === 1 && r.out.includes("manifest_sha256"), "pin without digest fields fails closed (exit 1)");
r = gate({ ...pin0, manifest_sha256: "nothex" }); ok(r.code === 1, "malformed digest in pin fails closed");
r = gate({ ...pin0, routes_count: 99 }); ok(r.code === 1 && r.out.includes("inconsistent"), "same digest but wrong routes_count = inconsistent pin, exit 1");
rmSync(mpath);
r = gate(pin0); ok(r.code === 4 && r.out.includes("unreadable"), "missing manifest exits non-zero (4)");
writeFileSync(mpath, "{not json"); r = gate(pin0); ok(r.code === 4 && r.out.includes("not valid JSON"), "unparsable manifest exits non-zero (4)");
writeFileSync(mpath, "[1,2]"); r = gate(pin0); ok(r.code === 4, "non-object manifest exits non-zero (4)");
writeFileSync(mpath, JSON.stringify({ routes: ["/"] })); r = gate(pin0); ok(r.code === 4 && r.out.includes("routes_count"), "manifest without routes_count exits non-zero (4)");
writeFileSync(mpath, t0);

// wire: stamp then tick, and the RESTART marker f424 consumes is written on a changed manifest
const pinP = w("stamp.json", { sha: A });
const mk = join(d, "state", "RESTART.json");
const tick = () => node(WIRE, ["tick", "--matrix", matrix, "--pin", pinP, ...x3.flatMap((x) => ["--x3", x]), "--head", A, "--manifest", mpath, "--marker", mk]);
r = node(WIRE, ["stamp", "--pin", pinP, "--manifest", mpath]);
const stamped = JSON.parse(readFileSync(pinP, "utf8"));
ok(r.code === 0 && stamped.manifest_sha256 === sha(t0) && stamped.routes_count === 3 && stamped.sha === A, "stamp writes digest + routes_count, keeps sha");
r = tick(); ok(r.code === 0 && !existsSync(mk), "tick after stamp passes, no marker");
writeFileSync(mpath, man([...base, "/c"]));
r = tick(); const m = existsSync(mk) ? JSON.parse(readFileSync(mk, "utf8")) : null;
ok(r.code === 1 && m && m.restart === true && r.out.includes("manifest changed"), "tick with a changed manifest = exit 1 + RESTART marker (same format as head move)");
rmSync(join(d, "state"), { recursive: true, force: true });
rmSync(mpath);
r = tick(); ok(r.code === 1 && existsSync(mk), "tick with a missing manifest fails closed with marker");
r = node(WIRE, ["stamp", "--pin", pinP, "--manifest", mpath]); ok(r.code === 1, "stamp with a missing manifest fails closed");
const before = readFileSync(pinP, "utf8");
writeFileSync(mpath, "{bad"); r = node(WIRE, ["stamp", "--pin", pinP, "--manifest", mpath]);
ok(r.code === 1 && readFileSync(pinP, "utf8") === before, "stamp with an unparsable manifest fails closed and leaves the pin untouched");

// real committed manifest: digest and count agree with the file on disk
const real = S("export_pages.json");
if (existsSync(real)) {
  const rj = JSON.parse(readFileSync(real, "utf8"));
  const f = (await import("./soak_pin_matrix_gate.mjs")).manifestFacts(real);
  ok(f.sha256 === sha(readFileSync(real)) && f.routes_count === rj.routes_count, `real scripts/export_pages.json: digest ${f.sha256.slice(0, 12)}, routes_count ${f.routes_count}`);
}

// mutants of the gate: each must make this suite fail on at least one case above (re-run the key cases against a planted copy)
const src = readFileSync(GATE, "utf8");
const killer = (name, from, to) => {
  if (!src.includes(from)) { ok(false, `mutant anchor present: ${name}`); return; }
  const mp = S(`.mut_${process.pid}.mjs`);
  writeFileSync(mp, src.replace(from, to));
  try {
    writeFileSync(mpath, t0);
    const clean = gate(pin0, [], mp);
    writeFileSync(mpath, man([...base, "/c"]));
    const added = gate(pin0, [], mp);
    writeFileSync(mpath, man(["/b", "/a", "/"]));
    const reord = gate(pin0, [], mp);
    rmSync(mpath);
    const missing = gate(pin0, [], mp);
    const nodig = gate({ sha: A }, [], mp);
    const killed = !(clean.code === 0 && added.code === 3 && reord.code === 3 && missing.code === 4 && nodig.code === 1);
    ok(killed, `mutant killed: ${name}`);
  } finally { rmSync(mp, { force: true }); }
};
killer("skip the digest comparison", "if (manifest.sha256 !== pin.manifest_sha256)", "if (false)");
killer("compare routes_count only", "if (manifest.sha256 !== pin.manifest_sha256)", "if (manifest.routes_count !== pin.routes_count)");
killer("digest of parsed content (sorted), not bytes", 'createHash("sha256").update(buf)', 'createHash("sha256").update(JSON.stringify(j.routes ? [...j.routes].sort() : j))');
killer("drop pin-field check", "typeof pin.manifest_sha256 !== \"string\" ||", "false ||");
killer("restart exit 1 instead of 3", "return { code: 3, line: `SOAKMX RESTART export manifest", "return { code: 1, line: `SOAKMX RESTART export manifest");
killer("missing manifest ignored", "return { err: `export manifest unreadable: ${path}` }", "return { sha256: \"0\".repeat(64), routes_count: 1 }");
killer("ignore --manifest entirely", "manifest = f; }", "}");

rmSync(d, { recursive: true, force: true });
console.log(`soak_pin_manifest: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
