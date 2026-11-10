#!/usr/bin/env bash
# f401: tests for obelisk_killflip_runbook.py. Synthetic matrix JSON only; nothing executed, nothing outbound.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
S=scripts/obelisk_killflip_runbook.py
LINT="${CONTENT_LINT:-/home/tech2/klinge-kernel/bin/content_lint.py}"
D=$(mktemp -d /tmp/f401kf.XXXXXX) || exit 1
[ -n "$D" ] && [ -d "$D" ] || exit 1
trap 'rm -rf "${D:?}"' EXIT
fail=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

python3 - "$D/board.json" <<'PY'
import json, sys
gates = {"C1": "LIVE TRAFFIC: needs the first 1,000 real scans", "C4": "GATE2 Stripe Connect: real first 10 jobs and live payouts",
         "C5": "DEPLOY: 1,000 shelves live needs the site deployed", "C7": "LIVE TRAFFIC: 10 EXTERNAL agents calling a deployed door",
         "C10": "LIVE TRAFFIC: 24 h chaos and load soak (VAL8 gate flip)"}
chunks = []
for i in range(1, 11):
    cid = f"C{i}"
    wf = cid in gates
    chunks.append({"id": cid, "chunk": f"Synthetic chunk {cid} — label", "kill": "synthetic kill test – text", "bar": "bar",
                   "command": f"node scripts/test_{cid.lower()}.mjs", "verifier": f"node scripts/verify_{cid.lower()}.mjs" if cid != "C1" else None,
                   "gate": gates.get(cid), "stage": None,
                   "status": "WOULD-FLIP" if wf else "INDEPENDENTLY VERIFIED",
                   "result": {"cmd": "x", "exit": 0, "seconds": 1.5, "tail": "# pass 12"},
                   "verifier_result": {"cmd": "y", "exit": 0, "seconds": 0.5, "tail": "ok"} if cid != "C1" else None,
                   "verification": "INDEPENDENTLY VERIFIED" if cid != "C1" else None})
json.dump({"head": "deadbeef", "counts": {}, "chunks": chunks}, open(sys.argv[1], "w"))
PY

# 1 every WOULD-FLIP chunk appears, others do not
python3 $S --matrix "$D/board.json" --out "$D/out.md" 2>"$D/err"; rc=$?
[ $rc -eq 0 ] && ok "exit 0 on a green board" || bad "exit $rc"
miss=0
for c in C1 C4 C5 C7 C10; do grep -q "^## $c:" "$D/out.md" || miss=1; done
[ $miss -eq 0 ] && ok "all five WOULD-FLIP chunks appear" || bad "a WOULD-FLIP chunk is missing"
grep -Eq '^## C(2|3|6|8|9):' "$D/out.md" && bad "non-gated chunk emitted" || ok "non-gated chunks not emitted"
grep -q "GATE5" "$D/out.md" && grep -q "GATE2" "$D/out.md" && grep -q "CARD NEEDED" "$D/out.md" && ok "gates and CARD NEEDED named" || bad "gates missing"
grep -q "already independently verified" -i "$D/out.md" && grep -q "SYNTHETIC" "$D/out.md" && ok "verified-in-code section and synthetic label" || bad "label or verified section missing"

# 2 FAILED chunk refused (exit 1, no file)
python3 - "$D/board.json" "$D/failed.json" <<'PY'
import json, sys
b = json.load(open(sys.argv[1]))
for c in b["chunks"]:
    if c["id"] == "C4": c["status"] = "FAILED"
json.dump(b, open(sys.argv[2], "w"))
PY
rm -f "$D/f.md"
python3 $S --matrix "$D/failed.json" --out "$D/f.md" 2>/dev/null; rc=$?
{ [ $rc -eq 1 ] && [ ! -e "$D/f.md" ]; } && ok "FAILED chunk refused, no output" || bad "FAILED not refused (rc $rc)"

# 3 mutation: drop one chunk => non-zero
python3 - "$D/board.json" "$D/drop.json" <<'PY'
import json, sys
b = json.load(open(sys.argv[1]))
b["chunks"] = [c for c in b["chunks"] if c["id"] != "C7"]
json.dump(b, open(sys.argv[2], "w"))
PY
python3 $S --matrix "$D/drop.json" --out "$D/d.md" 2>/dev/null; rc=$?
[ $rc -ne 0 ] && ok "dropped chunk exits non-zero ($rc)" || bad "dropped chunk accepted"

# 3b unknown WOULD-FLIP chunk (C2 turned WOULD-FLIP) has no gate entry => refused
python3 - "$D/board.json" "$D/new.json" <<'PY'
import json, sys
b = json.load(open(sys.argv[1]))
for c in b["chunks"]:
    if c["id"] == "C2": c["status"] = "WOULD-FLIP"; c["gate"] = "GATE9 new"
json.dump(b, open(sys.argv[2], "w"))
PY
python3 $S --matrix "$D/new.json" --out "$D/n.md" 2>/dev/null; rc=$?
[ $rc -eq 2 ] && ok "ungated new WOULD-FLIP refused" || bad "new WOULD-FLIP rc $rc"

# 3c garbage JSON
echo '{bad' > "$D/g.json"; python3 $S --matrix "$D/g.json" --out "$D/g.md" 2>/dev/null; rc=$?
[ $rc -eq 2 ] && ok "unreadable matrix refused" || bad "garbage rc $rc"

# 4 the script never runs anything: no process-spawning imports or calls
if grep -Eq 'subprocess|os\.system|os\.popen|os\.exec|os\.spawn|pty|eval\(|exec\(' $S; then bad "script can spawn processes"; else ok "script imports nothing that can run a command"; fi
touch "$D/canary"
python3 - "$D/board.json" "$D/inj.json" "$D/canary" <<'PY'
import json, sys
b = json.load(open(sys.argv[1]))
b["chunks"][0]["command"] = f"rm -f {sys.argv[3]}"; b["chunks"][0]["verifier"] = f"rm -f {sys.argv[3]}"
json.dump(b, open(sys.argv[2], "w"))
PY
python3 $S --matrix "$D/inj.json" --out "$D/i.md" 2>/dev/null
{ [ -e "$D/canary" ] && grep -q "rm -f" "$D/i.md"; } && ok "a hostile matrix command is printed, not executed" || bad "matrix command was run or lost"

# 5 zero em/en dashes, content_lint --no-cta clean
if LC_ALL=C.UTF-8 grep -nP '\x{2014}|\x{2013}' "$D/out.md" >/dev/null; then bad "em or en dash in output"; else ok "zero em/en dashes (input had both)"; fi
if [ -f "$LINT" ]; then
  python3 "$LINT" --no-cta "$D/out.md" >"$D/lint.out" 2>&1 && ok "content_lint --no-cta CLEAN" || { bad "content_lint"; cat "$D/lint.out"; }
else bad "content_lint not found at $LINT"; fi

[ $fail -eq 0 ] && echo "KILLFLIP TESTS OK" || echo "KILLFLIP TESTS FAILED"
exit $fail
