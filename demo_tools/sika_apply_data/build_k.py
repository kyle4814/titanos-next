#!/usr/bin/env python3
"""Builds the lazily loaded per-product knowledge files for the Sika demo portal from the knowledge and specs lane output.
  data/k/<id>.json     rates (page-cited facts), times, compat rules, safety (SDS quotes)   T15 T16 T21 T04
  data/k/_index.json   ids with a k file, lane generated stamps, taxonomy patterns for the tail matcher
  data/spec/<id>.json  draft specification clause set (data sheet wording, page cited)        T20
Usage: build_k.py <portal_data_dir> <lanes_dir>
Only what the lanes marked as found on a page by two extractors is copied; nothing is added or reworded.
"""
import json, os, sys

TIME_KINDS = ("open_time", "cure_times", "pot_life", "recoat_times")
RATE_KINDS = ("consumption", "coats", "layer_thickness", "mix_ratio")


def src(s):
    if not s: return None
    o = {"t": s.get("doc_type"), "u": s.get("url") or s.get("web_url"), "v": s.get("doc_version")}
    if s.get("page") is not None: o["p"] = s["page"]
    if s.get("page_end") not in (None, s.get("page")): o["pe"] = s["page_end"]
    if s.get("web_url") and s.get("url") and s["doc_type"] == "WEB": o["u"] = s["web_url"]
    if s.get("web_section"): o["sec"] = s["web_section"]
    return o


def fact(f):
    o = {"id": f["id"], "label": f.get("label"), "text": f["text"], "s": src(f["source"])}
    p = f.get("parsed") or {}
    if p: o["parsed"] = p
    if f.get("calc_ready") is not None: o["calc"] = bool(f["calc_ready"])
    for k in ("conditions", "table_header", "context", "table_product_cell", "flags"):
        if f.get(k): o[k] = f[k]
    return o


def sds_item(it):
    if it is None: return None
    if isinstance(it, list): return [sds_item(x) for x in it]
    o = {}
    for k, v in it.items():
        if k == "source": o["s"] = src(v)
        elif isinstance(v, dict) and "source" in v: o[k] = sds_item(v)
        elif isinstance(v, list): o[k] = [sds_item(x) if isinstance(x, dict) else x for x in v]
        else: o[k] = v
    return o


def sds(d):
    keep = {k: d.get(k) for k in ("title", "url", "revision_date", "version", "sds_number", "pages", "product_name_on_sds", "latest_for_name", "name_matches_product")}
    for k in ("classification", "hazard_statements", "precautionary_statements", "storage", "handling"):
        keep[k] = sds_item(d.get(k) or [])
    keep["signal_word"] = sds_item(d.get("signal_word"))
    keep["ppe"] = {k: sds_item(v) for k, v in (d.get("ppe") or {}).items()}
    keep["transport_adg"] = sds_item(d.get("transport_adg"))
    return keep


def main(data_dir, lanes):
    kn = os.path.join(lanes, "knowledge"); sp = os.path.join(lanes, "specs")
    rates = json.load(open(os.path.join(kn, "rates.json")))
    safety = json.load(open(os.path.join(kn, "safety.json")))
    compat = json.load(open(os.path.join(kn, "compatibility.json")))
    os.makedirs(os.path.join(data_dir, "k"), exist_ok=True); os.makedirs(os.path.join(data_dir, "spec"), exist_ok=True)
    index = json.load(open(os.path.join(data_dir, "index.json")))
    ids = [p["id"] for p in index]
    n_k = 0; sizes = 0
    for pid in ids:
        r = rates["products"].get(pid); s = safety["products"].get(pid); c = compat["products"].get(pid)
        o = {"v": 1, "id": pid}
        if r:
            o["rates"] = {"status": r["rate_status"], "ds": r.get("datasheet"), "facts": {k: [fact(f) for f in r["facts"].get(k, [])] for k in RATE_KINDS}}
            o["times"] = {k: [fact(f) for f in r["facts"].get(k, [])] for k in TIME_KINDS}
        if c:
            o["compat"] = [{"id": x["id"], "type": x["type"], "pol": x["polarity"], "cond": bool(x.get("conditional")), "tags": x.get("tags") or {}, "text": x["text"], "heading": x.get("heading"), "s": src(x["source"])} for x in c["rules"]]
        if s:
            all_sds = s.get("sds") or []
            o["safety"] = {"status": (s.get("summary") or {}).get("status"), "sds": [sds(d) for d in all_sds if d.get("latest_for_name")] or [sds(d) for d in all_sds[:1]]}
        if len(o) > 2:
            b = json.dumps(o, separators=(",", ":"), ensure_ascii=False)
            open(os.path.join(data_dir, "k", pid + ".json"), "w", encoding="utf-8").write(b); n_k += 1; sizes += len(b.encode())
    # specs
    n_s = 0; sbytes = 0
    for pid in ids:
        f = os.path.join(sp, "by_product", pid + ".json")
        if not os.path.exists(f): continue
        d = json.load(open(f))
        docs = [{k: x.get(k) for k in ("type", "title", "version", "url")} for x in d.get("documents", []) if x.get("url")]
        stds = [{k: x.get(k) for k in ("citation", "context", "section", "page", "role")} for x in d.get("standards_cited", [])]
        out = {"v": 1, "id": pid, "name": d.get("name_plain") or d.get("name"), "datasheet": {k: d["datasheet"].get(k) for k in ("url", "title", "edition", "version", "issued", "pages")},
               "paste": d.get("paste_text"), "standards": stds, "gaps": d.get("gaps", []), "documents": docs, "verification": (d.get("verification") or {}).get("method"), "stats": d.get("stats")}
        b = json.dumps(out, separators=(",", ":"), ensure_ascii=False)
        open(os.path.join(data_dir, "spec", pid + ".json"), "w", encoding="utf-8").write(b); n_s += 1; sbytes += len(b.encode())
    sys.path.insert(0, os.path.join(kn, "pipeline"))
    import taxonomy
    tax = {"substrate": {k: [x.pattern for x in v] for k, v in taxonomy.COMPILED["substrate"].items()}, "tile_type": {k: [x.pattern for x in v] for k, v in taxonomy.COMPILED["tile_type"].items()}, "environment": {k: [x.pattern for x in v] for k, v in taxonomy.COMPILED["environment"].items()}}
    idx = {"v": 1, "k": sorted(f[:-5] for f in os.listdir(os.path.join(data_dir, "k")) if f.endswith(".json") and not f.startswith("_")),
           "spec": sorted(f[:-5] for f in os.listdir(os.path.join(data_dir, "spec")) if f.endswith(".json")),
           "lanes": {"rates": rates["generated"], "safety": safety["generated"], "compatibility": compat["generated"]}, "taxonomy": tax}
    json.dump(idx, open(os.path.join(data_dir, "k", "_index.json"), "w"), separators=(",", ":"))
    print(json.dumps({"k_files": n_k, "k_bytes": sizes, "spec_files": n_s, "spec_bytes": sbytes, "lanes": idx["lanes"]}))


if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit("usage: build_k.py <portal_data_dir> <lanes_dir>")
    main(sys.argv[1], sys.argv[2])
