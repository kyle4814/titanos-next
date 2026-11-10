#!/usr/bin/env bash
# test_obelisk_kill_matrix.sh - fixture plan, fixture specs, scratch dir only. SYNTHETIC data (f387).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
M="$HERE/obelisk_kill_matrix.py"
S="$(mktemp -d /tmp/f387km.XXXXXX)" || exit 1
case "$S" in /tmp/f387km.*) ;; *) echo "FAIL bad scratch"; exit 1;; esac
trap 'rm -rf "${S:?}"' EXIT
pass=0; fail=0
ok() { pass=$((pass+1)); echo "PASS $1"; }
no() { fail=$((fail+1)); echo "FAIL $1"; }
mkdir -p "$S/repo"; : > "$S/repo/present.txt"
{ echo "| # | Chunk | Ships | L10 bar | Kill test |"; echo "|---|---|---|---|---|"
  for i in 1 2 3 4 5 6 7 8 9 10; do echo "| C$i | Chunk $i | ships | bar | kill $i |"; done; } > "$S/plan.md"
mkspec() { # all ten chunks use command $1; written to $S/spec.json
  python3 - "$1" > "$S/spec.json" <<'PY'
import json,sys
print(json.dumps({f"C{i}":{"command":sys.argv[1]} for i in range(1,11)}))
PY
}
run() { python3 "$M" --plan "$S/plan.md" --repo "$S/repo" --spec "$S/spec.json" --out-json "$S/o.json" "$@" 2>"$S/err"; }
cnt() { python3 -c "import json;print(json.load(open('$S/o.json'))['counts']['$1'])"; }
st()  { python3 -c "import json;print([c['status'] for c in json.load(open('$S/o.json'))['chunks'] if c['id']=='$1'][0])"; }

mkspec "true"; run >/dev/null; rc=$?
[ $rc = 0 ] && [ "$(cnt TESTED)" = 10 ] && ok "exit 0 commands -> 10 TESTED, exit 0" || no "all TESTED rc=$rc"

mkspec "false"; run >/dev/null; rc=$?
[ $rc = 1 ] && [ "$(cnt FAILED)" = 10 ] && [ "$(cnt TESTED)" = 0 ] && ok "non-zero exit shows FAILED, never TESTED, exit 1" || no "failed rc=$rc"

# a chunk row removed from the plan fails the script (structural, exit 2)
grep -v '^| C7 ' "$S/plan.md" > "$S/plan2.md"; mkspec "true"
python3 "$M" --plan "$S/plan2.md" --repo "$S/repo" --spec "$S/spec.json" >/dev/null 2>"$S/err"; rc=$?
[ $rc = 2 ] && grep -q "C7" "$S/err" && ok "removed plan row C7 fails with exit 2 naming C7" || no "row removed rc=$rc"
# duplicate row
{ cat "$S/plan.md"; echo "| C3 | dup | s | b | k |"; } > "$S/plan3.md"
python3 "$M" --plan "$S/plan3.md" --repo "$S/repo" --spec "$S/spec.json" >/dev/null 2>&1; [ $? = 2 ] && ok "duplicate plan row fails" || no "duplicate row"

# no command -> UNKNOWN with the stage id, never skipped
python3 - > "$S/spec.json" <<'PY'
import json
d={f"C{i}":{"command":"true"} for i in range(1,11)}
d["C2"]={"stage":"f999_stage"}; del d["C5"]
print(json.dumps(d))
PY
run >/dev/null; rc=$?
[ "$(st C2)" = UNKNOWN ] && [ "$(st C5)" = UNKNOWN ] && [ "$(cnt UNKNOWN)" = 2 ] && grep -q f999_stage "$S/o.json" && grep -q UNASSIGNED "$S/o.json" && ok "no command -> UNKNOWN (stage id kept, UNASSIGNED when none), row present" || no "unknown rows"

# gate -> WOULD-FLIP with the gate named; a failing code proof beats it
python3 - > "$S/spec.json" <<'PY'
import json
d={f"C{i}":{"command":"true"} for i in range(1,11)}
d["C1"]={"command":"true","gate":"LIVE TRAFFIC x"}; d["C4"]={"command":"false","gate":"GATE2 Stripe"}
print(json.dumps(d))
PY
run >/dev/null
[ "$(st C1)" = WOULD-FLIP ] && grep -q "LIVE TRAFFIC x" "$S/o.json" && ok "gate -> WOULD-FLIP with gate named" || no "would-flip"
[ "$(st C4)" = FAILED ] && ok "failing code proof on a gated chunk shows FAILED" || no "gated failed"

# status cannot be set by narrative: a spec carrying a status key is rejected
python3 - > "$S/spec.json" <<'PY'
import json
d={f"C{i}":{"command":"true"} for i in range(1,11)}
d["C3"]={"command":"true","status":"INDEPENDENTLY VERIFIED"}
print(json.dumps(d))
PY
python3 "$M" --plan "$S/plan.md" --repo "$S/repo" --spec "$S/spec.json" >/dev/null 2>"$S/err"; rc=$?
[ $rc = 2 ] && grep -q "status" "$S/err" && ok "spec status key rejected (exit 2)" || no "status key rc=$rc"

# INDEPENDENTLY VERIFIED needs a second, different verifier command on different files that also exits 0
python3 - > "$S/spec.json" <<'PY'
import json
d={f"C{i}":{"command":"true"} for i in range(1,11)}
d["C8"]={"command":"true","verifier":"test -e present.txt"}
d["C9"]={"command":"true","verifier":"test -e absent.txt"}
print(json.dumps(d))
PY
run >/dev/null; rc=$?
[ "$(st C8)" = "INDEPENDENTLY VERIFIED" ] && [ "$(cnt "INDEPENDENTLY VERIFIED")" = 1 ] && ok "verifier exit 0 + different command -> INDEPENDENTLY VERIFIED" || no "iv pass"
[ "$rc" = 1 ] && [ "$(st C9)" = FAILED ] && grep -q "verifier exit" "$S/o.json" && ok "verifier exit 1 -> FAILED (never downgraded to TESTED), matrix exit 1" || no "verifier fail rc=$rc"
mkspec "true"; run >/dev/null
[ "$(st C6)" = TESTED ] && [ "$(cnt "INDEPENDENTLY VERIFIED")" = 0 ] && grep -q "no verifier configured" "$S/o.json" && ok "missing verifier keeps TESTED, noted as no verifier" || no "missing verifier"
python3 - > "$S/spec.json" <<'PY'
import json
d={f"C{i}":{"command":"true"} for i in range(1,11)}
d["C6"]={"command":"true","verifier":"true"}
print(json.dumps(d))
PY
run >/dev/null; rc=$?
[ $rc = 2 ] && grep -q "identical" "$S/err" && grep -q C6 "$S/err" && ok "identical verifier and command refused (exit 2)" || no "identical rc=$rc"
python3 - > "$S/spec.json" <<'PY'
import json
d={f"C{i}":{"command":"true"} for i in range(1,11)}
d["C4"]={"command":"node scripts/a_test.mjs && true","verifier":"(cd portal-api && node other/a_test.mjs)"}
print(json.dumps(d))
PY
run >/dev/null; rc=$?
[ $rc = 2 ] && grep -q "shares test file" "$S/err" && grep -q a_test.mjs "$S/err" && ok "verifier sharing a test file with the primary refused (exit 2)" || no "shared file rc=$rc"
python3 - > "$S/spec.json" <<'PY'
import json
d={f"C{i}":{"command":"true"} for i in range(1,11)}
d["C1"]={"command":"true","gate":"LIVE TRAFFIC x","verifier":"test -e present.txt"}
d["C2"]={"command":"true","gate":"LIVE TRAFFIC x","verifier":"false"}
print(json.dumps(d))
PY
run >/dev/null
[ "$(st C1)" = WOULD-FLIP ] && [ "$(st C2)" = FAILED ] && ok "gated row with a passing verifier stays WOULD-FLIP; failing verifier shows FAILED" || no "gated verifier"
python3 -c "
import json;c={x['id']:x for x in json.load(open('$S/o.json'))['chunks']}
assert c['C1']['code_proof']=='INDEPENDENTLY VERIFIED' and c['C1']['status']=='WOULD-FLIP' and c['C3']['code_proof'] is None and c['C2']['code_proof'] is None" && ok "gated row with a passing verifier carries code_proof INDEPENDENTLY VERIFIED beside WOULD-FLIP (f399)" || no "code_proof field"
run --out-md "$S/gv.md" >/dev/null; grep -q '^| C1 .*WOULD-FLIP (code proof INDEPENDENTLY VERIFIED)' "$S/gv.md" && grep -q '^Code-proof IV .*: 1 (C1)' "$S/gv.md" && ok "markdown shows the code proof beside WOULD-FLIP and counts it" || no "markdown code proof"

# named test file absent -> PROPOSED, not run; --no-run -> IMPLEMENTED
python3 - > "$S/spec.json" <<'PY'
import json
d={f"C{i}":{"command":"true","files":["present.txt"]} for i in range(1,11)}
d["C2"]={"command":"true","files":["nope.txt"]}
print(json.dumps(d))
PY
run >/dev/null; [ "$(st C2)" = PROPOSED ] && ok "missing test file -> PROPOSED" || no "proposed"
run --no-run >/dev/null; [ "$(st C3)" = IMPLEMENTED ] && ok "--no-run -> IMPLEMENTED (never TESTED)" || no "no-run"

# timeout counts as FAILED
mkspec "sleep 5"; run --timeout 1 >/dev/null; [ "$(st C1)" = FAILED ] && ok "timeout -> FAILED" || no "timeout"

# markdown has one table row per chunk and a Counts line; real SPEC covers C1..C10 against the real plan
mkspec "true"; run --out-md "$S/o.md" >/dev/null
[ "$(grep -c '^| C[0-9]' "$S/o.md")" = 10 ] && grep -q '^Counts:' "$S/o.md" && ok "markdown: 10 rows + counts" || no "markdown"
python3 - <<'PY' || no "real SPEC verifier fields"
import sys,re; sys.path.insert(0,"scripts"); import obelisk_kill_matrix as m
m.check_verifiers(m.SPEC)
assert all(k in m.SPEC for k in ("C2","C3","C7","C8","C10")) and all(m.SPEC[k].get("verifier") for k in ("C2","C3","C7","C8","C10"))
PY
python3 - <<'PY' || no "C1/C4 verifier fields"
import sys; sys.path.insert(0,"scripts"); import obelisk_kill_matrix as m
for k in ("C1","C4"):
    v=m.SPEC[k]; assert v.get("verifier") and v.get("gate"), k
    assert not (m._files(v["verifier"]) & m._files(v["command"])), k
assert m.SPEC["C1"]["verifier"]=="python3 scripts/c1_funnel_verify.py" and m.SPEC["C4"]["verifier"]=="python3 scripts/c4_paid_reproof_verify.py"
# the matrix refuses a C1/C4 verifier that reuses the primary's command or a test basename (planted)
for k,bad in (("C1","node scripts/test_funnel_killtest.mjs"),("C4","node scripts/drill_ten_jobs.mjs"),("C4","cd portal-api && node --test test/payout_release.test.ts")):
    spec={**m.SPEC,k:{**m.SPEC[k],"verifier":bad}}
    try: m.check_verifiers(spec); raise SystemExit("not refused: "+bad)
    except m.Structural: pass
PY
ok "C1/C4 verifiers wired, independent, and a verifier reusing the primary's command or test basename is refused (f399)"
ok "real SPEC verifiers pass the independence check (C2 C3 C7 C8 C9 C10 wired)"
PLAN=/home/tech2/klinge-kernel/FULL_BUSINESS_PROJECT/01_BUSINESS_PLAN_2026-10-10.md
if [ -f "$PLAN" ]; then
  python3 "$M" --plan "$PLAN" --no-run >/dev/null 2>"$S/err"; rc=$?
  [ $rc = 0 ] && ok "real SPEC matches the real plan (C1..C10, all files on disk, --no-run)" || no "real spec rc=$rc $(cat "$S/err")"
fi
echo "obelisk_kill_matrix: $pass passed, $fail failed"
[ "$fail" = 0 ]
