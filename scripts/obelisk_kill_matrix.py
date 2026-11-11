#!/usr/bin/env python3
"""obelisk_kill_matrix.py - the obelisk completion board the soak is judged against (f387).

Reads the chunk table C1..C10 from the business plan (chapter 6), pairs each chunk's kill test with the exact
command that proves it, RUNS that command fresh (own suites only) and derives the status word from the exit code.
Status can never be raised by narrative: the only inputs are the plan table, the spec below and exit codes.

Status words (CORE EXEC3 ladder plus the two honest extras):
  UNKNOWN                 no command exists; `stage` names the stage id that would supply one
  PROPOSED                a command is named but its test file is not on disk
  IMPLEMENTED             the command exists but was not run (--no-run)
  TESTED                  the command ran fresh and exited 0 (code tests green; the live kill test is a separate matter)
  INDEPENDENTLY VERIFIED  TESTED and a SECOND, different verifier command (independent suite) also exited 0
  FAILED                  a command exited non-zero or timed out (never shown as TESTED)
  WOULD-FLIP              the kill test itself needs live traffic or a GATE; the gate is named and the code-proof
                          result is shown beside it (a failing code proof still shows FAILED)

usage: python3 scripts/obelisk_kill_matrix.py [--plan PLAN.md] [--repo DIR] [--spec spec.json] [--no-run]
                                              [--out-md F] [--out-json F] [--timeout S]
exit: 0 no FAILED; 1 at least one FAILED; 2 structural (plan row missing/duplicated, spec orphan, bad spec key).
"""
import argparse, json, os, re, shlex, subprocess, sys, time

DEFAULT_PLAN = "/home/tech2/klinge-kernel/FULL_BUSINESS_PROJECT/01_BUSINESS_PLAN_2026-10-10.md"
EXPECTED = [f"C{i}" for i in range(1, 11)]
STATUSES = ["UNKNOWN", "PROPOSED", "IMPLEMENTED", "TESTED", "INDEPENDENTLY VERIFIED", "FAILED", "WOULD-FLIP"]
ALLOWED_KEYS = {"command", "verifier", "gate", "stage", "files", "verifier_stage", "verifier_files"}
FILE_TOK = re.compile(r"[\w./-]+\.(?:mjs|cjs|js|ts|py|sh)\b")
PA = "(cd portal-api && node --test --experimental-strip-types"
NS = "node --experimental-strip-types"

# kill test -> proof command. `gate` set = the kill test itself needs live traffic or a GATE (WOULD-FLIP).
# `files` = paths that must exist for the command to count as present (else PROPOSED).
SPEC = {
    "C1": {"command": f"{NS} scripts/test_guestscan.mjs && node scripts/test_funnel_killtest.mjs",
           "files": ["scripts/test_guestscan.mjs", "scripts/test_funnel_killtest.mjs"],
           "gate": "LIVE TRAFFIC: needs the first 1,000 real scans"},
    "C2": {"command": f"{PA} test/drill.test.ts)", "files": ["portal-api/test/drill.test.ts"],
           "verifier": f"(cd portal-api && {NS} scripts/flow16_matrix.ts --check)", "verifier_files": ["portal-api/scripts/flow16_matrix.ts"]},
    "C3": {"command": "node scripts/test_drill_twenty_faults.mjs", "files": ["scripts/test_drill_twenty_faults.mjs"],
           "verifier": "node scripts/drill_twenty_faults.mjs", "verifier_files": ["scripts/drill_twenty_faults.mjs"]},
    "C4": {"command": f"node scripts/drill_ten_jobs.mjs && {PA} test/drill_ten_jobs.test.ts test/payout_release.test.ts)",
           "files": ["scripts/drill_ten_jobs.mjs", "portal-api/test/drill_ten_jobs.test.ts", "portal-api/test/payout_release.test.ts"],
           "gate": "GATE2 Stripe Connect: real first 10 jobs and live payouts"},
    "C5": {"command": "node scripts/test_graded_store.mjs && node scripts/test_shelves_fetch_budget.mjs",
           "files": ["scripts/test_graded_store.mjs", "scripts/test_shelves_fetch_budget.mjs"],
           "verifier": f"{NS} --no-warnings scripts/c5_ungraded_verify.mjs 1000 && {NS} --no-warnings scripts/test_c5_ungraded_verify.mjs",
           "verifier_files": ["scripts/c5_ungraded_verify.mjs", "scripts/test_c5_ungraded_verify.mjs", "scripts/shelf_scale_drill.mjs"],
           "gate": "DEPLOY: 1,000 shelves live needs the site deployed"},
    "C6": {"command": f"{NS} scripts/test_concierge_holdout.mjs", "files": ["scripts/test_concierge_holdout.mjs"],
           "verifier": "python3 scripts/c6_holdout_verify.py", "verifier_files": ["scripts/c6_holdout_verify.py", "scripts/concierge_asklog_dump.mjs"]},
    "C7": {"command": f"{PA} test/agents10.test.ts test/agent.test.ts test/keycap.test.ts)",
           "files": ["portal-api/test/agents10.test.ts", "portal-api/test/agent.test.ts", "portal-api/test/keycap.test.ts"],
           "verifier": f"(cd portal-api && {NS} scripts/agents10.ts && {NS} scripts/c7_ledger_verify.ts && node --test --experimental-strip-types test/c7_ledger_verify.test.ts)",
           "verifier_files": ["portal-api/scripts/agents10.ts", "portal-api/scripts/c7_ledger_verify.ts", "portal-api/test/c7_ledger_verify.test.ts"],
           "gate": "LIVE TRAFFIC: 10 EXTERNAL agents calling a deployed door"},
    "C8": {"command": f"{PA} test/tenant_isolation.test.ts) && node scripts/test_xtenant_route_matrix.mjs",
           "files": ["portal-api/test/tenant_isolation.test.ts", "scripts/test_xtenant_route_matrix.mjs"],
           "verifier": "node scripts/xtenant_route_matrix.mjs", "verifier_files": ["scripts/xtenant_route_matrix.mjs"]},
    "C9": {"command": "node scripts/test_c9proof.mjs", "files": ["scripts/test_c9proof.mjs"],
           "verifier": "node scripts/figure_freshness.mjs && node scripts/test_figure_freshness_allowlist.mjs",
           "verifier_files": ["scripts/figure_freshness.mjs", "scripts/test_figure_freshness_allowlist.mjs"]},
    "C10": {"command": "node scripts/test_soak_harness.mjs", "files": ["scripts/test_soak_harness.mjs"],
            "verifier": 'd=$(mktemp -d /tmp/f389soak.XXXXXX) && node scripts/soak_harness.mjs --duration 2 --interval 1 --rps 50 --out "$d/board.json"; rc=$?; rm -rf "${d:?}"; exit $rc',
            "verifier_files": ["scripts/soak_harness.mjs"],
            "gate": "LIVE TRAFFIC: 24 h chaos and load soak (VAL8 gate flip)"},
}


class Structural(Exception):
    pass


def parse_plan(text):
    rows = []
    for line in text.split("\n"):
        m = re.match(r"^\|\s*C(\d+)\s*\|(.*)\|\s*$", line)
        if not m:
            continue
        cells = [c.strip() for c in m.group(2).split("|")]
        if len(cells) < 4:
            continue
        rows.append({"id": f"C{int(m.group(1))}", "chunk": cells[0], "bar": cells[-2], "kill": cells[-1]})
    return rows


def check_structure(rows, spec):
    ids = [r["id"] for r in rows]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        raise Structural(f"duplicate plan rows: {dup}")
    missing = [i for i in EXPECTED if i not in ids]
    if missing:
        raise Structural(f"plan chunk row(s) removed: {missing} (the board needs exactly C1..C10)")
    extra = [i for i in ids if i not in EXPECTED]
    if extra:
        raise Structural(f"unexpected plan chunk rows: {extra}")
    orphan = [k for k in spec if k not in ids]
    if orphan:
        raise Structural(f"spec has chunks not in the plan: {orphan}")
    for k, v in spec.items():
        bad = set(v) - ALLOWED_KEYS
        if bad:
            raise Structural(f"{k}: spec key(s) {sorted(bad)} not allowed (status is derived from exit codes, never written)")
    check_verifiers(spec)


def _norm(c):
    return " ".join(c.split())


def _files(c):
    return {os.path.basename(t) for t in FILE_TOK.findall(c)}


def check_verifiers(spec):
    """A verifier counts only if it is a DIFFERENT command on DIFFERENT files. Refused structurally (exit 2), never ignored."""
    for k, v in spec.items():
        ver = v.get("verifier")
        if not ver:
            continue
        if not v.get("command"):
            raise Structural(f"{k}: verifier set but no primary command")
        if _norm(ver) == _norm(v["command"]):
            raise Structural(f"{k}: verifier is identical to the primary command (refused: no independence)")
        shared = _files(ver) & _files(v["command"])
        if shared:
            raise Structural(f"{k}: verifier shares test file(s) {sorted(shared)} with the primary command (refused: no independence)")


def run_cmd(cmd, cwd, timeout):
    t = time.time()
    try:
        r = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, timeout=timeout, executable="/bin/bash")
        code, out = r.returncode, (r.stdout or "") + (r.stderr or "")
    except subprocess.TimeoutExpired as e:
        code, out = 124, f"TIMEOUT after {timeout}s"
    lines = [l for l in out.splitlines() if l.strip() and "Warning" not in l and "trace-warnings" not in l]
    sig = [l for l in lines if re.search(r"pass|fail|ok|PASS|FAIL|OK|\d+ tests?", l)]
    lines = sig or lines
    return {"cmd": cmd, "exit": code, "seconds": round(time.time() - t, 1), "tail": lines[-1][:160] if lines else ""}


def evaluate(row, entry, repo, run, timeout):
    out = dict(row)
    out.update({"command": None, "verifier": None, "gate": None, "stage": None, "result": None, "verifier_result": None, "verification": None})
    if not entry or not entry.get("command"):
        stage = (entry or {}).get("stage") or "UNASSIGNED"
        out.update({"status": "UNKNOWN", "stage": stage, "detail": f"no command; stage id that would supply it: {stage}"})
        return out
    out["command"] = entry["command"]
    out["verifier"] = entry.get("verifier")
    out["gate"] = entry.get("gate")
    absent = [f for f in entry.get("files", []) + entry.get("verifier_files", []) if not os.path.exists(os.path.join(repo, f))]
    if absent:
        out.update({"status": "PROPOSED", "detail": f"named test file(s) not on disk: {absent}"})
        return out
    if not run:
        out.update({"status": "IMPLEMENTED", "detail": "command on disk, not run (--no-run)"})
        return out
    res = run_cmd(entry["command"], repo, timeout)
    out["result"] = res
    if res["exit"] != 0:
        out.update({"status": "FAILED", "detail": f"exit {res['exit']}: {res['tail']}"})
        return out
    status, detail = "TESTED", f"exit 0 in {res['seconds']}s"
    if not entry.get("verifier"):
        out["detail_note"] = "no verifier configured" + (f"; stage that would supply one: {entry.get('verifier_stage') or 'UNASSIGNED'}")
    if entry.get("verifier"):
        v = run_cmd(entry["verifier"], repo, timeout)
        out["verifier_result"] = v
        if v["exit"] != 0:
            out.update({"status": "FAILED", "detail": f"verifier exit {v['exit']}: {v['tail']}"})
            return out
        status = "INDEPENDENTLY VERIFIED"
        out["verification"] = "INDEPENDENTLY VERIFIED"  # f398: the CODE proof is independently verified even when a live gate keeps the row at WOULD-FLIP
    if entry.get("gate"):
        out.update({"status": "WOULD-FLIP", "detail": f"code proof exit 0 in {res['seconds']}s" + ("; verifier exit 0" if out["verifier_result"] else "") + f"; kill test needs {entry['gate']}"})
    else:
        out.update({"status": status, "detail": detail + ("" if status == "INDEPENDENTLY VERIFIED" else "; " + out.get("detail_note", ""))})
    return out


def render_md(results, head, counts):
    esc = lambda s: (s or "").replace("|", "/")
    L = [f"# Obelisk kill matrix (integration head {head})", "",
         "Status derives from fresh exit codes only. TESTED = code tests green, NOT the live kill test met. WOULD-FLIP = the kill test needs live traffic or a GATE.", "",
         "| # | Chunk | Kill test | Proof command | Latest result | Status | Gate or stage |", "|---|---|---|---|---|---|---|"]
    for r in results:
        res = r["result"]
        shown = f"exit {res['exit']} in {res['seconds']}s: {res['tail']}" if res else r["detail"]
        if r["verifier_result"]:
            shown += f"; verifier exit {r['verifier_result']['exit']} in {r['verifier_result']['seconds']}s"
        L.append(f"| {r['id']} | {esc(r['chunk'])} | {esc(r['kill'])} | `{esc(r['command'] or 'none')}`{(' verifier: `' + esc(r['verifier']) + '`') if r['verifier'] else ''} | {esc(shown)} | {r['status']}{('; code INDEPENDENTLY VERIFIED' if r['verification'] and r['status'] != r['verification'] else '')} | {esc(r['gate'] or r['stage'] or '')} |")
    ivany = sum(1 for r in results if r["verification"])
    L += ["", "Counts: " + ", ".join(f"{s} {counts[s]}" for s in STATUSES) + f", code INDEPENDENTLY VERIFIED (any gate) {ivany}", ""]
    return "\n".join(L)


def build(plan_text, spec, repo, run=True, timeout=900):
    rows = parse_plan(plan_text)
    check_structure(rows, spec)
    rows = sorted(rows, key=lambda r: int(r["id"][1:]))
    results = [evaluate(r, spec.get(r["id"]), repo, run, timeout) for r in rows]
    counts = {s: 0 for s in STATUSES}
    for r in results:
        counts[r["status"]] += 1
    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=repo, capture_output=True, text=True).stdout.strip() or "UNKNOWN"
    except OSError:
        head = "UNKNOWN"
    counts_v = {"code_independently_verified_any_gate": sum(1 for r in results if r["verification"]), "ids": [r["id"] for r in results if r["verification"]]}
    return {"head": head, "counts": counts, "verification": counts_v, "chunks": results}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", default=DEFAULT_PLAN)
    ap.add_argument("--repo", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--spec")
    ap.add_argument("--no-run", action="store_true")
    ap.add_argument("--timeout", type=int, default=900)
    ap.add_argument("--out-md")
    ap.add_argument("--out-json")
    a = ap.parse_args(argv)
    spec = json.load(open(a.spec)) if a.spec else SPEC
    try:
        board = build(open(a.plan).read(), spec, a.repo, not a.no_run, a.timeout)
    except Structural as e:
        print(f"KILLMATRIX STRUCTURAL {e}", file=sys.stderr)
        return 2
    md = render_md(board["chunks"], board["head"], board["counts"])
    print(md)
    if a.out_md:
        open(a.out_md, "w").write(md)
    if a.out_json:
        json.dump(board, open(a.out_json, "w"), indent=2)
    print("JSON " + json.dumps(board["counts"]))
    return 1 if board["counts"]["FAILED"] else 0


if __name__ == "__main__":
    sys.exit(main())
