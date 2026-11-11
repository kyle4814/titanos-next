#!/usr/bin/env python3
"""C6 independent verifier (f396). Recomputes the concierge holdout score from the RAW ask log with a separate
implementation (Python, own Wilson algebra, own grouping) and FAILS on any disagreement with the primary
(scripts/concierge_holdout.mjs output). Shares no scoring code with the primary or its test.

  python3 scripts/c6_holdout_verify.py                      live: dump raw log via node, run primary, compare
  python3 scripts/c6_holdout_verify.py --log L --primary P  fixture mode (synthetic, no node needed)
Exit 0 = agree on every number, 1 = disagreement, 2 = unusable input. Zero model/network calls."""
import json, math, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEATS = ["guest", "owner", "pro", "agent", "enterprise", "partner"]


def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    den = n + z * z
    mid = (k + z * z / 2) / den
    half = z * math.sqrt(n * p * (1 - p) + z * z / 4) / den
    return (mid - half, mid + half)


def verdict(rec):
    if rec["kind"] == "match":
        return rec["shelf"], [rec["shelf"]] + list(rec["alts"])
    if rec["kind"] == "ask":
        return "ask", list(rec["taps"])
    return "none", ["none"]


def score(log):
    rows = []
    for r in log:
        got, top3 = verdict(r)
        rows.append({"seat": r["seat"], "expect": r["expect"], "ok": got == r["expect"], "in3": r["expect"] in top3})
    n = len(rows)
    sh = [r for r in rows if r["expect"] not in ("none", "ask")]
    nn = [r for r in rows if r["expect"] == "none"]
    aa = [r for r in rows if r["expect"] == "ask"]
    c = lambda xs, f="ok": sum(1 for x in xs if x[f])
    out = {"n": n, "ok": c(rows), "in3": c(rows, "in3"), "shelf_n": len(sh), "shelf_ok": c(sh), "shelf_in3": c(sh, "in3"),
           "none_n": len(nn), "none_ok": c(nn), "ask_n": len(aa), "ask_ok": c(aa)}
    for s in SEATS:
        g = [r for r in rows if r["seat"] == s]
        out["seat_" + s] = (c(g), len(g))
    return out


def pct(x):
    return round(100 * x, 1)


def expected_numbers(sc):
    """name -> value, in the primary's own printed precision (1 dp for percentages)."""
    e = {}
    for key, k, n in (("overall", sc["ok"], sc["n"]), ("top3", sc["in3"], sc["n"]), ("shelf", sc["shelf_ok"], sc["shelf_n"]),
                      ("none", sc["none_ok"], sc["none_n"]), ("ask", sc["ask_ok"], sc["ask_n"])):
        e[key + ".k"], e[key + ".n"] = k, n
        e[key + ".pct"] = pct(k / n) if n else 0.0
        lo, hi = wilson(k, n)
        e[key + ".lo"], e[key + ".hi"] = pct(lo), pct(hi)
    e["shelf_top3.k"] = sc["shelf_in3"]
    for s in SEATS:
        e["seat_" + s + ".k"], e["seat_" + s + ".n"] = sc["seat_" + s]
    return e


NUM = r"(-?\d+(?:\.\d+)?)"
PATTERNS = [
    ("n", r"HOLDOUT n=(\d+)"),
    ("overall", rf"overall right: (\d+)/(\d+) = {NUM}% Wilson95 \[{NUM}%, {NUM}%\]"),
    ("top3", rf"top3: (\d+)/(\d+) = {NUM}% \[{NUM}%, {NUM}%\]"),
    ("shelf", rf"shelf asks right: (\d+)/(\d+) = {NUM}% \[{NUM}%, {NUM}%\]  top3: (\d+)/"),
    ("none", rf"kept unmatched: (\d+)/(\d+) \[{NUM}%, {NUM}%\]"),
    ("ask", rf"near-duplicate -> ask: (\d+)/(\d+) \[{NUM}%, {NUM}%\]"),
]


def parse_primary(text):
    got, bad = {}, []
    m = re.search(PATTERNS[0][1], text)
    if not m:
        return None, ["no HOLDOUT header in primary output"]
    got["n_header"] = int(m.group(1))
    for key, rx in PATTERNS[1:]:
        m = re.search(rx, text)
        if not m:
            bad.append("primary line missing: " + key)
            continue
        g = m.groups()
        got[key + ".k"], got[key + ".n"] = int(g[0]), int(g[1])
        if key in ("none", "ask"):
            got[key + ".lo"], got[key + ".hi"] = float(g[2]), float(g[3])
            n = int(g[1])
            got[key + ".pct"] = pct(int(g[0]) / n) if n else 0.0  # not printed; derived from the primary's own k/n
        else:
            got[key + ".pct"], got[key + ".lo"], got[key + ".hi"] = float(g[2]), float(g[3]), float(g[4])
        if key == "shelf":
            got["shelf_top3.k"] = int(g[5])
    for s in SEATS:
        m = re.search(rf"seat {s}: (\d+)/(\d+)", text)
        if not m:
            bad.append("primary line missing: seat " + s)
        else:
            got["seat_" + s + ".k"], got["seat_" + s + ".n"] = int(m.group(1)), int(m.group(2))
    return got, bad


def compare(sc, primary_text):
    exp = expected_numbers(sc)
    got, bad = parse_primary(primary_text)
    if got is None:
        return bad
    diffs = list(bad)
    if got["n_header"] != sc["n"]:
        diffs.append(f"n: primary {got['n_header']} vs recomputed {sc['n']}")
    for k, v in exp.items():
        if k not in got:
            continue
        tol = 0.051 if k.endswith((".pct", ".lo", ".hi")) else 0
        if abs(got[k] - v) > tol:
            diffs.append(f"{k}: primary {got[k]} vs recomputed {v}")
    return diffs


def check_log_against_tsv(log, tsv_path):
    """The raw log must be the holdout file itself: same rows, same order, same expectations."""
    rows = [l.split("\t") for l in open(tsv_path, encoding="utf8").read().split("\n") if l]
    if len(rows) != len(log):
        return [f"log has {len(log)} asks, holdout.tsv has {len(rows)}"]
    return [f"ask {i}: log ({r['seat']},{r['expect']}) != holdout.tsv ({t[0]},{t[1]})"
            for i, (r, t) in enumerate(zip(log, rows)) if (r["seat"], r["expect"]) != (t[0], t[1])]


def main(argv):
    a = {"--log": None, "--primary": None, "--tsv": None}
    i = 1
    while i < len(argv):
        if argv[i] not in a or i + 1 >= len(argv):
            print("usage: c6_holdout_verify.py [--log L --primary P [--tsv T]]"); return 2
        a[argv[i]] = argv[i + 1]; i += 2
    node = ["node", "--experimental-strip-types"]
    try:
        if a["--log"]:
            logtxt = open(a["--log"], encoding="utf8").read()
        else:
            logtxt = subprocess.run(node + ["scripts/concierge_asklog_dump.mjs"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        if a["--primary"]:
            ptxt = open(a["--primary"], encoding="utf8").read()
        else:
            ptxt = subprocess.run(node + ["scripts/concierge_holdout.mjs"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        log = [json.loads(l) for l in logtxt.split("\n") if l.strip()]
        if not log:
            raise ValueError("empty ask log")
    except (OSError, ValueError, subprocess.CalledProcessError, KeyError) as e:
        print("C6 VERIFY UNUSABLE:", e); return 2
    tsv = a["--tsv"] or (None if a["--log"] else os.path.join(ROOT, "lib/concierge/holdout.tsv"))
    diffs = check_log_against_tsv(log, tsv) if tsv else []
    sc = score(log)
    diffs += compare(sc, ptxt)
    if diffs:
        print(f"C6 VERIFY DISAGREE ({len(diffs)}):"); [print("  -", d) for d in diffs]; return 1
    print(f"C6 VERIFY AGREE n={sc['n']} right={sc['ok']} top3={sc['in3']} (independent recompute from raw ask log matches primary on every number)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
