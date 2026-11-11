#!/usr/bin/env node
// soak_pin_wire.mjs - WIRING for the SOAK RULE (f412, C10, 2026-11-11). Calls f397 scripts/soak_pin_matrix_gate.mjs (never re-implements it).
//   soak tick : node scripts/soak_pin_wire.mjs tick  --matrix M --pin P --x3 X [--x3 X ...] --repo R --ref REF [--marker state/soak/RESTART.json]
//   pre-merge : node scripts/soak_pin_wire.mjs merge --pin P --repo R [--marker ...] [--accept-restart]
// tick: gate PASS (exit 0) is the only pass. FAIL/ERROR/RESTART/anything else = exit 1 and a restart marker (the soak does not count; x3 must re-run on the new sha).
// merge: no PIN.json = no soak running = exit 0. A live pin means a merge moves the head and restarts the soak: exit 1 + marker unless --accept-restart,
//        which writes the marker (soak restarts, x3 re-runs) and exits 0. Unreadable pin = exit 1 (fail closed).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const GATE = fileURLToPath(new URL("./soak_pin_matrix_gate.mjs", import.meta.url));
export const DEFAULT_MARKER = "state/soak/RESTART.json";

export function writeMarker(path, reason, extra = {}) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ restart: true, reason, at: new Date().toISOString(), ...extra }, null, 2));
}

// -> {code, line}. code 0 only when the f397 gate printed PASS and exited 0.
export function tickGate({ matrix, pin, x3 = [], repo, ref, head, marker = DEFAULT_MARKER, gate = GATE }) {
  const args = [gate, "--matrix", matrix || "", "--pin", pin || "", ...x3.flatMap((x) => ["--x3", x])];
  if (head) args.push("--head", head); else args.push("--repo", repo || "", "--ref", ref || "");
  const r = spawnSync("node", args, { encoding: "utf8" });
  const line = ((r.stdout || "") + (r.stderr || "")).trim().split("\n").pop() || "";
  if (r.status === 0 && /\bPASS\b/.test(line)) return { code: 0, line };
  writeMarker(marker, line || `gate exit ${r.status}`, { gate_exit: r.status, stage: "tick" });
  return { code: 1, line: `SOAKWIRE RESTART ${line || "gate produced no output (exit " + r.status + ")"}` };
}

export function mergeGate({ pin, repo, marker = DEFAULT_MARKER, acceptRestart = false }) {
  if (!pin || !existsSync(pin)) return { code: 0, line: "SOAKWIRE MERGE OK no soak pin, no soak running" };
  let sha;
  try { sha = JSON.parse(readFileSync(pin, "utf8")).sha; } catch { sha = undefined; }
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) {
    writeMarker(marker, "pin unreadable or sha invalid at merge", { stage: "merge", pin });
    return { code: 1, line: `SOAKWIRE MERGE FAIL pin ${pin} unreadable or not a 40-hex sha` };
  }
  writeMarker(marker, `merge during soak pinned at ${sha}`, { stage: "merge", pinned: sha, repo });
  if (acceptRestart) return { code: 0, line: `SOAKWIRE MERGE RESTART accepted, soak pinned ${sha.slice(0, 9)} restarts and x3 re-runs` };
  return { code: 1, line: `SOAKWIRE MERGE FAIL soak live on ${sha.slice(0, 9)}; merging restarts it (pass --accept-restart)` };
}

function parse(argv) {
  const a = { x3: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--accept-restart") a.acceptRestart = true;
    else if (k === "--x3") a.x3.push(argv[++i]);
    else if (k.startsWith("--")) a[k.slice(2)] = argv[++i];
  }
  return a;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const a = parse(rest);
  const r = mode === "tick" ? tickGate(a) : mode === "merge" ? mergeGate(a) : { code: 1, line: "SOAKWIRE FAIL usage: tick|merge" };
  console.log(r.line);
  process.exit(r.code);
}
