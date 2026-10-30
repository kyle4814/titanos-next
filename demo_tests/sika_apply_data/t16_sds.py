#!/usr/bin/env python3
"""T16 ACCEPT: for five sampled products every displayed safety phrase is a substring of the cited SDS page text, re-extracted with pypdf
(an extractor different from the lane's PyMuPDF), and the cited page number matches. Reads the lane's read-only PDF cache; no network.
Exit 0 only if all phrases verify. If the cache is missing the test reports SKIPPED and exits 3 (never a pass)."""
import hashlib, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "..", "public", "demo", "sika-210c0c", "data")
KCACHE = os.environ.get("KCACHE", "/tmp/claude-1000/-home-tech2/1750d873-1338-4f62-8f64-9d5dd1fec824/scratchpad/kcache")
try:
    import pypdf
except ImportError:
    print("t16_sds: SKIPPED (pypdf not importable)"); sys.exit(3)
if not os.path.isdir(os.path.join(KCACHE, "pdf")):
    print("t16_sds: SKIPPED (PDF cache not found at KCACHE)"); sys.exit(3)

def squash(s):
    s = s.lower().replace("º", "°").replace("˚", "°").replace("²", "2").replace("³", "3").replace("−", "-").replace("–", "-").replace("—", "-").replace("’", "'").replace("‘", "'")
    return re.sub(r"[^a-z0-9%°<>=~±]", "", s)

def pages_of(url):
    path = os.path.join(KCACHE, "pdf", hashlib.sha1(url.encode()).hexdigest() + ".pdf")
    if not os.path.exists(path): return None
    r = pypdf.PdfReader(path)
    return [pg.extract_text() or "" for pg in r.pages]

def on_pages(phrase, wins):
    """Is the phrase on the cited page? A statement that runs over a page break is matched greedily page by page
    (the running header and footer sit between the two halves, so a plain substring over the joined pages would fail)."""
    q = squash(phrase)
    if any(q in w for w in wins): return True
    pos = 0
    for w in wins:
        if pos >= len(q): break
        best = 0
        for n in range(len(q) - pos, min(5, len(q) - pos - 1), -1):
            if q[pos:pos + n] in w: best = n; break
        pos += best
    return pos >= len(q) and len(wins) > 1

def items(sds):
    out = []
    if sds.get("signal_word"): out.append(("signal word", sds["signal_word"]["value"], sds["signal_word"]["s"], sds["signal_word"]["text"]))
    for key in ("hazard_statements", "precautionary_statements", "storage", "handling", "classification"):
        for it in sds.get(key) or []:
            out.append((key, it.get("text"), it["s"], it.get("text")))
    for key, it in (sds.get("ppe") or {}).items(): out.append(("ppe " + key, it["text"], it["s"], it["text"]))
    t = sds.get("transport_adg")
    if t and t.get("text"): out.append(("transport", t["text"], t["s"], t["text"]))
    return out

SAMPLE = ["davco-grey-one-potadhesive", "davco-trojan-mastic", "davco-easy-grout", "sikaflex-11-fc-purform", "sikafloor-264"]
total = bad = skipped = 0
for pid in SAMPLE:
    f = os.path.join(DATA, "k", pid + ".json")
    if not os.path.exists(f): print("  missing k file", pid); bad += 1; continue
    k = json.load(open(f)); l = (k.get("safety") or {}).get("sds") or []
    sds = next((d for d in l if d.get("latest_for_name") and d.get("name_matches_product")), None)
    if not sds: print("  no matching SDS", pid); bad += 1; continue
    pg = pages_of(sds["url"])
    if pg is None: print("  SDS PDF not in cache", pid); skipped += 1; continue
    # the SDS words are the ones the portal prints (plain() turns en and em dashes into hyphens, handled by squash)
    n = 0
    for label, phrase, s, _ in items(sds):
        if not phrase: continue
        total += 1; n += 1
        lo, hi = s["p"], s.get("pe", s["p"])
        if not on_pages(phrase, [squash(x) for x in pg[lo - 1:hi]]):
            bad += 1; print(f"  FAIL {pid} p{lo}-{hi} [{label}]: {phrase[:90]!r}")
    print(f"  {pid}: {n} phrases checked against SDS {sds['revision_date']} pages ({len(pg)} pages)")
# mutation: a tampered phrase must NOT verify
_k = json.load(open(os.path.join(DATA, "k", SAMPLE[0] + ".json"))); _s = next(d for d in _k["safety"]["sds"] if d.get("latest_for_name") and d.get("name_matches_product")); _w = [squash(x) for x in pages_of(_s["url"])]
if on_pages("Wear a purple hat at all times when stirring", _w) or on_pages(_s["storage"][0]["text"] + " Drink the product.", _w):
    bad += 1; print("  FAIL mutation: tampered phrase verified")
print(f"t16_sds: {total - bad} verified, {bad} failed, {skipped} products skipped, {total} phrases")
sys.exit(1 if bad else (3 if skipped else 0))
