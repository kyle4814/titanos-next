#!/usr/bin/env bash
# test_c4_paid_reproof_verify.sh - SYNTHETIC ledger (mock Stripe, in-memory store) in a scratch dir (f399). Proves the independent C4
# verifier holds on the real code's ledger, and exits non-zero on planted ledger edits AND on planted source mutants of the payout code.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"
V="$HERE/c4_paid_reproof_verify.py"
S="$(mktemp -d /tmp/f399c4.XXXXXX)" || exit 1
case "$S" in /tmp/f399c4.*) ;; *) echo "FAIL bad scratch"; exit 1;; esac
trap 'rm -rf "${S:?}"' EXIT
pass=0; fail=0
ok() { pass=$((pass+1)); echo "PASS $1"; }
no() { fail=$((fail+1)); echo "FAIL $1"; }

(cd "$ROOT/portal-api" && node --experimental-strip-types scripts/c4_ledger_dump.ts 2>/dev/null) > "$S/ledger.jsonl"
python3 "$V" --ledger "$S/ledger.jsonl" >"$S/out" 2>&1; rc=$?
[ $rc = 0 ] && grep -q "jobs=10 re-proved=6 paid=6 transfers=6 paid-with-proof=6/6 (100%)" "$S/out" && ok "real ledger: 10 jobs, 6 re-proved, 6 paid, 4 unproven unpaid -> exit 0" || { no "real ledger rc=$rc"; cat "$S/out"; }
python3 "$V" >"$S/out" 2>&1; [ $? = 0 ] && ok "live mode (dump + verify) exits 0" || no "live mode"

# ledger edits: each one plants a failure the verifier must name
mut() { # mut NAME PYTHON-EDIT EXPECTED-TEXT ; edit receives list L of dicts
  python3 - "$S/ledger.jsonl" "$S/m.jsonl" "$2" <<'PY'
import json,sys
L=[json.loads(x) for x in open(sys.argv[1]) if x.strip()]
exec(sys.argv[3])
open(sys.argv[2],"w").write("\n".join(json.dumps(x) for x in L)+"\n")
PY
  python3 "$V" --ledger "$S/m.jsonl" >"$S/out" 2>&1; rc=$?
  [ $rc = 1 ] && grep -q "$3" "$S/out" && ok "MUTANT $1 -> exit 1" || { no "MUTANT $1 rc=$rc"; cat "$S/out"; }
}
mut "transfer recorded for an unproven job" 'u=[x for x in L if x["t"]=="job" and x["status"]=="delivered"][0]; L.append({"t":"call","op":"transfer","args":{"connect":"acct_x","cents":24900,"group":u["id"],"key":"k"}})' "P2 job .* transferred with no passing proof"
mut "double transfer on a paid job" 'p=[x for x in L if x["t"]=="call" and x["op"]=="transfer"][0]; L.append(dict(p))' "P1 job .* has 2 transfers"
mut "paid status with no transfer" 'p=[i for i,x in enumerate(L) if x["t"]=="call" and x["op"]=="transfer"][0]; del L[p]' "P3 job .* is paid with no transfer"
mut "proof baseline already PASS" 'j=[x for x in L if x["t"]=="job" and x["status"]=="paid"][0]; j["proof"]["baseline"]="PASS"' "P2 job .* baseline was already PASS"
mut "proof predates the claim" 'j=[x for x in L if x["t"]=="job" and x["status"]=="paid"][0]; j["proof"]["at"]=j["claimedAt"]-1' "P2 job .* proof predates the claim"
mut "forged proof (last re-scan was not PASS)" 'j=[x for x in L if x["t"]=="job" and x["status"]=="paid"][0]; j["lastRescan"]["status"]="WARN"' "P7 job .* not backed by a passing re-scan"
mut "payout amount differs from the transfer" 'j=[x for x in L if x["t"]=="job" and x["status"]=="paid" and x["priceCents"]<50000][0]; j["payout"]["amountCents"]-=100' "P2 job .* amounts differ"
mut "large payout with no approved review card" 'L[:]=[x for x in L if x["t"]!="card"]' "P5 job .* with no approved payout_review card"
mut "review card never approved" 'c=[x for x in L if x["t"]=="card"][0]; c["outcome"]="deny"' "P5 job .* no approved payout_review card"
mut "re-proved job left unpaid" 'j=[x for x in L if x["t"]=="job" and x["status"]=="paid" and x["priceCents"]<50000][0]; j["status"]="reproved"; L[:]=[x for x in L if not (x["t"]=="call" and x["op"]=="transfer" and x["args"].get("group")==j["id"])]' "P4 job .* passing proof but is reproved"
mut "paid job with its proof deleted" 'j=[x for x in L if x["t"]=="job" and x["status"]=="paid"][0]; del j["proof"]' "P4 job .* paid with no passing proof"
mut "claim fee missing" 'c=[i for i,x in enumerate(L) if x["t"]=="call" and x["op"]=="claim_fee"][0]; del L[c]' "P6 claim fees 9 != claimed jobs 10"

# SOURCE mutants of the real payout/re-proof code, ledger regenerated from a scratch copy: the verifier must go red
srcmut() { # srcmut NAME OLD NEW EXPECT
  rm -rf "${S:?}/cp"; mkdir "$S/cp"; cp -r "$ROOT/portal-api" "$ROOT/lib" "$S/cp/"
  python3 - "$S/cp/portal-api/src/market/service.ts" "$2" "$3" <<'PY' || { no "SRCMUTANT $1 (pattern missing)"; return; }
import sys
p,a,b=sys.argv[1:4]; s=open(p).read()
if a not in s: sys.exit(1)
open(p,"w").write(s.replace(a,b,1))
PY
  python3 "$V" --portal-api "$S/cp/portal-api" >"$S/out" 2>&1; rc=$?
  [ $rc = 1 ] && grep -q "$4" "$S/out" && ok "SRCMUTANT $1 -> exit 1" || { no "SRCMUTANT $1 rc=$rc"; head -5 "$S/out"; }
}
srcmut "re-scan accepts anything but FAIL as proof" 'if (finding?.status === "PASS" && (j.baseline' 'if (finding?.status !== "FAIL" && (j.baseline' "P7 job"
srcmut "review line removed (large payout skips the card)" 'if (amount >= PAYOUT_REVIEW_CENTS && !approvedCardId)' 'if (amount >= 999999999 && !approvedCardId)' "P5 job"
echo "c4_paid_reproof_verify: $pass passed, $fail failed"
[ "$fail" = 0 ]
