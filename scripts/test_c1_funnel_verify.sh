#!/usr/bin/env bash
# test_c1_funnel_verify.sh - SYNTHETIC logs (ids SYN-*) in a scratch dir (f399). Proves the independent C1 verifier agrees with the
# primary on the fixture and on random logs, and exits non-zero on planted failures.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
V="$HERE/c1_funnel_verify.py"; P="$HERE/funnel_killtest.mjs"; FIX="$HERE/fixtures/funnel_synthetic.ndjson"
S="$(mktemp -d /tmp/f399c1.XXXXXX)" || exit 1
case "$S" in /tmp/f399c1.*) ;; *) echo "FAIL bad scratch"; exit 1;; esac
trap 'rm -rf "${S:?}"' EXIT
pass=0; fail=0
ok() { pass=$((pass+1)); echo "PASS $1"; }
no() { fail=$((fail+1)); echo "FAIL $1"; }
gen() { # gen SCANS PRESSES -> ndjson on stdout
  python3 - "$1" "$2" <<'PY'
import json,sys
s,p=int(sys.argv[1]),int(sys.argv[2])
for k in range(s): print(json.dumps({"event":"scan-instant-run","path":"/scan","scanId":f"SYN-{k}","ts":1000000+k*1000}))
for k in range(p): print(json.dumps({"event":"scan-get-fixed","path":"/scan","scanId":f"SYN-{k}","ts":1000001+k*1000}))
PY
}

python3 "$V" >"$S/out" 2>&1; rc=$?
[ $rc = 0 ] && grep -q "^AGREE scans=1050 presses=32 first1000=31/1000" "$S/out" && ok "live fixture: independent recompute agrees with the primary (31/1000, PASS)" || { no "fixture rc=$rc"; cat "$S/out"; }

for sp in "1000 30:PASS" "1000 29:FAIL" "999 999:PENDING_LIVE" "1200 36:PASS" "1000 0:FAIL"; do
  a="${sp%%:*}"; want="${sp##*:}"; gen $a > "$S/g.ndjson"
  python3 "$V" "$S/g.ndjson" >"$S/out" 2>&1; rc=$?
  [ $rc = 0 ] && grep -q "verdict=$want" "$S/out" && ok "generated $a -> $want, agrees with the primary" || { no "generated $a rc=$rc"; cat "$S/out"; }
done

# differential fuzz: 40 random messy logs (dupes, orphans, bots, malformed, shuffled, ts missing) -> verifier must agree every time
python3 - "$S" <<'PY'
import json,random,sys
d=sys.argv[1]
for case in range(40):
    r=random.Random(case); n=r.choice([5,50,1000,1040]); L=[]
    for k in range(n): L.append({"event":"scan-instant-run","scanId":f"SYN-{k}","ts":r.choice([None,1000000+r.randint(0,10**6)])})
    for k in range(r.randint(0,60)): L.append({"event":"scan-get-fixed","scanId":f"SYN-{r.randint(0,n+5)}","ts":r.randint(0,2*10**6)})
    for _ in range(r.randint(0,5)): L.append({"event":"scan-instant-run","scanId":f"SYN-BOT{_}","bot":True,"ts":5})
    for _ in range(r.randint(0,3)): L.append({"event":"pageview","path":"/"})
    L=[json.dumps(x) for x in L]+["{bad","[]",'{"event":"scan-instant-run","ts":"nope"}']
    r.shuffle(L); open(f"{d}/f{case}.ndjson","w").write("\n".join(L)+"\n")
PY
bad=0; for i in $(seq 0 39); do python3 "$V" "$S/f$i.ndjson" >"$S/out" 2>&1 || { bad=$((bad+1)); head -3 "$S/out"; }; done
[ $bad = 0 ] && ok "differential fuzz: 40 random messy logs, verifier agrees with the primary on all" || no "fuzz: $bad disagreements"

# planted failure 1: primary's press count inflated (fixture mode)
node "$P" "$FIX" > "$S/p.json"; sed 's/"first1000_presses":31/"first1000_presses":40/' "$S/p.json" > "$S/p1.json"
python3 "$V" "$FIX" --primary-json "$S/p1.json" >"$S/out" 2>&1; rc=$?
[ $rc = 1 ] && grep -q "first1000_presses: primary 40 vs recomputed 31" "$S/out" && ok "MUTANT primary press count inflated -> exit 1" || no "inflate rc=$rc"
# planted failure 2: primary verdict flipped PASS -> FAIL
sed 's/"verdict":"PASS"/"verdict":"FAIL"/' "$S/p.json" > "$S/p2.json"
python3 "$V" "$FIX" --primary-json "$S/p2.json" >"$S/out" 2>&1; rc=$?
[ $rc = 1 ] && grep -q "verdict" "$S/out" && ok "MUTANT primary verdict flipped -> exit 1" || no "verdict rc=$rc"
# planted failure 3: event log loses presses but the primary's claim (30/1000 PASS) stands
gen 1000 30 > "$S/m.ndjson"; node "$P" "$S/m.ndjson" > "$S/pm.json"; gen 1000 29 > "$S/m2.ndjson"
python3 "$V" "$S/m2.ndjson" --primary-json "$S/pm.json" >"$S/out" 2>&1; rc=$?
[ $rc = 1 ] && grep -q "recomputed 'FAIL'" "$S/out" && ok "MUTANT log drift (29 presses vs primary's 30 PASS) -> exit 1" || no "drift rc=$rc"
# planted failure 4: a primary that wrongly counts a duplicate press twice (presses 31 instead of 30)
gen 1000 30 > "$S/d.ndjson"; echo '{"event":"scan-get-fixed","scanId":"SYN-0","ts":1000002}' >> "$S/d.ndjson"
sed 's/"presses":30/"presses":31/' "$S/pm.json" > "$S/p4.json"
python3 "$V" "$S/d.ndjson" --primary-json "$S/p4.json" >"$S/out" 2>&1; rc=$?
[ $rc = 1 ] && ok "MUTANT duplicate press double-counted by the primary -> exit 1" || no "dup rc=$rc"
# the 3% bar bites: a verifier with a 2% bar would call 29/1000 a PASS; this one must not
gen 1000 29 > "$S/b.ndjson"; python3 "$V" "$S/b.ndjson" 2>&1 | grep -q "verdict=FAIL" && ok "3% bar bites: 29/1000 is FAIL" || no "bar"

# unusable input -> exit 2
python3 "$V" /nonexistent/x.ndjson >/dev/null 2>&1; [ $? = 2 ] && ok "unreadable log -> exit 2" || no "unreadable"
python3 "$V" "$FIX" --primary-json /nonexistent/p.json >/dev/null 2>&1; [ $? = 2 ] && ok "unreadable primary json -> exit 2" || no "unreadable primary"
echo '{nope' > "$S/junk.json"; python3 "$V" "$FIX" --primary-json "$S/junk.json" >/dev/null 2>&1; [ $? = 2 ] && ok "garbage primary json -> exit 2" || no "garbage primary"
echo "c1_funnel_verify: $pass passed, $fail failed"
[ "$fail" = 0 ]
