#!/usr/bin/env python3
"""C1 independent verifier (f399). Recomputes the guest-scan -> GET THIS FIXED press rate from the RAW synthetic event
log with a separate implementation (Python, own parsing, own ordering, integer maths) and FAILS on any disagreement with
the primary (scripts/funnel_killtest.mjs output). Shares no code and no test file with test_guestscan.mjs or
test_funnel_killtest.mjs.

  python3 scripts/c1_funnel_verify.py [events.ndjson]        live: recompute, run primary on the same file, compare
  python3 scripts/c1_funnel_verify.py EV --primary-json P    fixture mode: P holds the primary's one-line JSON
Default log: scripts/fixtures/funnel_synthetic.ndjson (SYNTHETIC ids SYN-*). Zero network, zero model calls.
Rules (plan ch.6 C1, restated from the spec header, not copied from code): a press counts once per scan id; a press with no
matching scan or no scanId is an orphan; bot-flagged events are excluded; the first 1,000 scans are chosen by timestamp
(missing ts sorts last, then line order); PASS needs presses*100 >= 3*1000 inside that window; fewer than 1,000 scans = PENDING_LIVE.
Exit 0 = agree, 1 = disagreement, 2 = unusable input."""
import datetime, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_LOG = os.path.join(ROOT, "scripts", "fixtures", "funnel_synthetic.ndjson")
SCAN, PRESS, WINDOW, MIN_PCT = "scan-instant-run", "scan-get-fixed", 1000, 3


def ts_of(v):
    """-> (ok, value|None)"""
    if v is None:
        return True, None
    if isinstance(v, bool):
        return False, None
    if isinstance(v, (int, float)):
        return (True, v) if v == v and abs(v) != float("inf") else (False, None)
    if isinstance(v, str):
        try:
            return True, datetime.datetime.fromisoformat(v.replace("Z", "+00:00")).timestamp() * 1000
        except ValueError:
            return False, None
    return False, None


def recompute(lines):
    cnt = dict(malformed=0, ignoredOther=0, botExcluded=0, duplicateScans=0, duplicatePresses=0, orphanPresses=0, scansWithoutId=0)
    scans, presses, seen, bot_scans = [], [], set(), set()
    for ln, raw in enumerate(lines):
        if not raw.strip():
            continue
        try:
            o = json.loads(raw)
        except ValueError:
            cnt["malformed"] += 1
            continue
        if not isinstance(o, dict) or not isinstance(o.get("event"), str):
            cnt["malformed"] += 1
            continue
        ok, ts = ts_of(o.get("ts"))
        sid = o.get("scanId")
        if not ok or (sid is not None and (not isinstance(sid, str) or sid == "")) or ("bot" in o and not isinstance(o["bot"], bool)):
            cnt["malformed"] += 1
            continue
        ev = o["event"]
        if ev not in (SCAN, PRESS):
            cnt["ignoredOther"] += 1
            continue
        if o.get("bot") is True:
            cnt["botExcluded"] += 1
            if ev == SCAN and sid:
                bot_scans.add(sid)
            continue
        rec = (float("inf") if ts is None else ts, ln, sid)
        if ev == SCAN:
            if sid is None:
                cnt["scansWithoutId"] += 1
                scans.append(rec)
            elif sid in seen:
                cnt["duplicateScans"] += 1
            else:
                seen.add(sid)
                scans.append(rec)
        else:
            presses.append(rec)
    scans.sort(key=lambda r: (r[0], r[1]))
    window = {r[2] for r in scans[:WINDOW] if r[2]}
    paid, paid_window = set(), set()
    for _, _, sid in presses:
        if not sid or (sid not in seen and sid not in bot_scans):
            cnt["orphanPresses"] += 1
        elif sid in bot_scans:
            cnt["botExcluded"] += 1
        elif sid in paid:
            cnt["duplicatePresses"] += 1
        else:
            paid.add(sid)
            if sid in window:
                paid_window.add(sid)
    n, m, f, fm = len(scans), len(paid), min(len(scans), WINDOW), len(paid_window)
    r4 = lambda a, b: None if b == 0 else int(a / b * 10000 + 0.5) / 10000
    verdict = "PENDING_LIVE" if n < WINDOW else ("PASS" if fm * 100 >= MIN_PCT * WINDOW else "FAIL")
    return dict(scans=n, presses=m, rate=r4(m, n), first1000_rate=r4(fm, f), first1000_scans=f, first1000_presses=fm, verdict=verdict, **cnt)


def main(argv):
    args, pj, path = list(argv), None, None
    if "--primary-json" in args:
        i = args.index("--primary-json")
        pj = args[i + 1] if i + 1 < len(args) else None
        del args[i:i + 2]
        if pj is None:
            print("C1VERIFY unusable: --primary-json needs a path", file=sys.stderr)
            return 2
    path = args[0] if args else DEFAULT_LOG
    try:
        text = open(path, encoding="utf8").read()
    except OSError as e:
        print(f"C1VERIFY unusable: cannot read {path}: {e}", file=sys.stderr)
        return 2
    mine = recompute(text.split("\n"))
    try:
        if pj:
            primary_line = open(pj, encoding="utf8").read().strip().splitlines()[-1]
        else:
            r = subprocess.run(["node", os.path.join(ROOT, "scripts", "funnel_killtest.mjs"), path], capture_output=True, text=True, timeout=120)
            if r.returncode != 0:
                print(f"C1VERIFY unusable: primary exit {r.returncode}: {r.stderr.strip()[:200]}", file=sys.stderr)
                return 2
            primary_line = r.stdout.strip().splitlines()[-1]
        primary = json.loads(primary_line)
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        print(f"C1VERIFY unusable: primary output: {e}", file=sys.stderr)
        return 2
    bad = [f"{k}: primary {primary.get(k)!r} vs recomputed {v!r}" for k, v in mine.items() if primary.get(k) != v]
    if bad:
        for b in bad:
            print("DISAGREE " + b)
        print(f"C1VERIFY FAILED {len(bad)} disagreement(s)")
        return 1
    print(f"AGREE scans={mine['scans']} presses={mine['presses']} first1000={mine['first1000_presses']}/{mine['first1000_scans']} "
          f"rate={mine['first1000_rate']} verdict={mine['verdict']} (live kill test stays WOULD-FLIP: needs the first 1,000 real scans)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
