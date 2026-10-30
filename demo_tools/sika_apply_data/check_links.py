#!/usr/bin/env python3
"""T03 document link health, verification only and OFFLINE: no request is made by this script.
The portal builder merged the link verdicts into documents.json (d.http) and stats.json. This script re-derives what it can from the status lines the crawler and
the knowledge and specs lanes logged (tab separated: time, method, status, bytes, url) and fails if a verdict disagrees with a logged status.
Usage: check_links.py <portal_data_dir> <sika_state_dir>   (arguments are required; nothing is guessed)
"""
import json, os, sys, urllib.parse


def alts(d):
    u = d["url"]; a = []
    if "/content/dam/" in u: a.append(u.replace("/content/dam/", "/dam/"))
    elif "/dam/dms/" in u: a.append(u.replace("/dam/dms/", "/content/dam/dms/"))
    if d.get("dmsUrl") and d["dmsUrl"] != u: a.append(d["dmsUrl"])
    return a


def read_logs(state):
    """url -> (status, time, who). A 200 beats a non-200 for the same URL (a later success is the truth)."""
    seen = {}
    for rel, who in (("lanes/knowledge/pipeline/fetch.log", "knowledge lane"), ("lanes/specs/fetch.log", "specs lane"), ("crawl/crawl.log", "crawler")):
        p = os.path.join(state, rel)
        if not os.path.exists(p): continue
        for line in open(p, errors="replace"):
            f = line.rstrip("\n").split("\t")
            if len(f) < 5 or f[1] not in ("GET", "HEAD") or not f[2].isdigit(): continue
            st = int(f[2]); u = f[4]
            old = seen.get(u)
            if old is None or (old[0] != 200 and (st == 200 or f[0] > old[1])): seen[u] = (st, f[0], who + " " + f[1])
    return seen


def main(data_dir, state):
    """Cross-check the link verdicts merged into documents.json (d.http) against the status lines the lanes logged. Offline; writes nothing."""
    docs = json.load(open(os.path.join(data_dir, "documents.json")))
    logs = read_logs(state)
    agree = disagree = logged_only_unmerged = unverifiable = 0
    problems = []
    for d in docs:
        verdict = (d.get("http") or {}).get("status")
        variants = [d["url"]] + alts(d) + ([d["http"]["url"]] if d.get("http") and d["http"].get("url") else [])
        seen = [logs.get(v) or logs.get(urllib.parse.unquote(v)) for v in variants]
        seen = [x for x in seen if x]
        if not seen: unverifiable += 1; continue
        logged_ok = any(x[0] == 200 for x in seen)
        if verdict is None: logged_only_unmerged += 1; problems.append((d["id"], "logged but no verdict merged"))
        elif (verdict == 200) == logged_ok: agree += 1
        else: disagree += 1; problems.append((d["id"], f"verdict {verdict} but logs say {'200' if logged_ok else seen[0][0]}"))
    st = json.load(open(os.path.join(data_dir, "stats.json")))
    ok = sum(1 for d in docs if (d.get("http") or {}).get("status") == 200); bad = sum(1 for d in docs if d.get("http") and d["http"].get("status") != 200)
    unchecked = len(docs) - ok - bad
    out = {"documents": len(docs), "verdict_ok": ok, "verdict_failed": bad, "verdict_missing": unchecked, "stats_json": {k: st.get(k) for k in ("docs_link_ok", "docs_link_failed", "docs_link_unchecked")},
           "logs_agree": agree, "logs_disagree": disagree, "logged_but_unmerged": logged_only_unmerged, "no_log_line_to_compare": unverifiable}
    print(json.dumps(out))
    for pr in problems[:10]: print("  PROBLEM", pr)
    stats_ok = (st.get("docs_link_ok"), st.get("docs_link_failed"), st.get("docs_link_unchecked")) == (ok, bad, unchecked)
    if not stats_ok: print("  PROBLEM stats.json does not match documents.json")
    return 0 if (disagree == 0 and logged_only_unmerged == 0 and stats_ok) else 1


if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit("usage: check_links.py <portal_data_dir> <sika_state_dir>")
    sys.exit(main(sys.argv[1], sys.argv[2]))
