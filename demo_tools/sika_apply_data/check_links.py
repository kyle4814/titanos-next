#!/usr/bin/env python3
"""T03 document link health, OFFLINE mode only: no request is made by this script.
Reads the status lines that the crawler and the knowledge and specs lanes already logged (tab separated: time, method, status, bytes, url)
plus crawl/doc_status.json when the portal builder's HEAD checker has produced it, and writes data/doc_status.json and the counts in data/stats.json.
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
    docs = json.load(open(os.path.join(data_dir, "documents.json")))
    logs = read_logs(state)
    ext = {}
    ep = os.path.join(state, "crawl", "doc_status.json")
    if os.path.exists(ep): ext = json.load(open(ep))
    out = {}
    for d in docs:
        rec = None
        if d["id"] in ext:
            e = ext[d["id"]]
            rec = {"status": e["status"], "checked": e.get("checked", ""), "via": "HEAD check " + str(e.get("via", "")), **({"url": e["url"]} if e.get("url") and e["url"] != d["url"] else {})}
        else:
            variants = [d["url"]] + alts(d)
            for u in variants:
                s = logs.get(u) or logs.get(urllib.parse.unquote(u))
                if s and s[0] == 200:
                    rec = {"status": 200, "checked": s[1], "via": "logged by " + s[2]}
                    if u != d["url"]: rec["url"] = u
                    break
            if rec is None:
                for u in variants:
                    s = logs.get(u) or logs.get(urllib.parse.unquote(u))
                    if s:
                        rec = {"status": s[0], "checked": s[1], "via": "logged by " + s[2], "variants_seen": sum(1 for v in variants if logs.get(v))}
                        break
        if rec: out[d["id"]] = rec
    ok = sum(1 for r in out.values() if r["status"] == 200); bad = sum(1 for r in out.values() if r["status"] != 200)
    json.dump(out, open(os.path.join(data_dir, "doc_status.json"), "w"), separators=(",", ":"), sort_keys=True)
    sp = os.path.join(data_dir, "stats.json"); st = json.load(open(sp))
    st.update({"docs_link_ok": ok, "docs_link_failed": bad, "docs_link_unchecked": len(docs) - ok - bad})
    json.dump(st, open(sp, "w"), separators=(",", ":"))
    idx = {p["id"]: p for p in json.load(open(os.path.join(data_dir, "index.json")))}
    tile = [d for d in docs if any("tile-stone" in idx.get(pid, {}).get("c", "") for pid in d.get("products", []))]
    tile_unchecked = sum(1 for d in tile if d["id"] not in out)
    st["docs_link_unchecked_tile_stone"] = tile_unchecked
    json.dump(st, open(sp, "w"), separators=(",", ":"))
    print(json.dumps({"documents": len(docs), "ok": ok, "failed": bad, "unchecked": len(docs) - ok - bad, "tile_stone_docs": len(tile), "tile_stone_unchecked": tile_unchecked, "external_status_file": bool(ext)}))
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit("usage: check_links.py <portal_data_dir> <sika_state_dir>")
    sys.exit(main(sys.argv[1], sys.argv[2]))
