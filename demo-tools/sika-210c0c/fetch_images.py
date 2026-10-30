#!/usr/bin/env python3
"""fetch_images.py: pick each product's main packshot, download it at 480 and 960 wide, convert to WebP, write images_source.json.
   python3 fetch_images.py <portal> <crawl cache dir> [--live]
   Source order: first 1x1 smartcrop dynamicmedia.sika.com asset on the product page (the gallery's first image), else a sika.scene7.com sikacs :1-1 packshot.
   --live re-fetches the page (1 request a second, browser user agent, robots.txt honoured: no query strings) for products whose cached page has no packshot.
   The Sika logo is never taken. Files: assets/img/p/<id>-480.webp and -960.webp. Re-runnable: existing files are kept."""
import sys, os, re, json, glob, html, time, io, urllib.request, urllib.error
from PIL import Image
portal, cache = sys.argv[1], sys.argv[2]; live = "--live" in sys.argv
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
here = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(portal, "assets", "img", "p"); os.makedirs(OUT, exist_ok=True)
products = json.load(open(os.path.join(portal, "data", "products.json")))
pages = {}
for f in glob.glob(os.path.join(cache, "*.json")):
    d = json.load(open(f))
    for k in (d.get("url"), d.get("final")):
        if k: pages[k] = d.get("text") or ""
DM = re.compile(r"https://dynamicmedia\.sika\.com/adobe/assets/(urn:aaid:aem:[0-9a-f-]+)/as/([^\"'?\s<>]+)\?smartcrop=1-1")
S7 = re.compile(r"https://sika\.scene7\.com/is/image/sikacs/([^\"'?\s<>:]+):1-1")
def pick(t):
    t = html.unescape(t)
    m = DM.search(t)
    if m: return {"kind": "dynamicmedia", "urn": m.group(1), "name": m.group(2), "base": "https://dynamicmedia.sika.com/adobe/assets/%s/as/%s" % (m.group(1), m.group(2))}
    m = S7.search(t)
    if m: return {"kind": "scene7", "name": m.group(1), "base": "https://sika.scene7.com/is/image/sikacs/" + m.group(1)}
    return None
def fetch(u):
    req = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=40) as r: return r.read()
def sized(src, w):
    if src["kind"] == "dynamicmedia": return "%s?smartcrop=1-1&width=%d&height=%d" % (src["base"], w, w)
    return "%s:1-1?wid=%d&hei=%d&fmt=png-alpha" % (src["base"], w, w)
def webp(raw, path, w):
    im = Image.open(io.BytesIO(raw)); im.load()
    if im.mode not in ("RGB", "RGBA"): im = im.convert("RGBA")
    if im.width != w: im = im.resize((w, w), Image.LANCZOS)
    im.save(path, "WEBP", quality=80, method=6)
res = {}; last = [0.0]
def polite():
    d = 1.0 - (time.time() - last[0]);  time.sleep(max(0, d)); last[0] = time.time()
bycache = {}  # sized-url -> bytes, so a shared generic packshot is fetched once
for p in products:
    t = pages.get(p["url"])
    src = pick(t) if t else None; via = "cache"
    if not src and live and "?" not in p["url"]:
        try:
            polite(); t = fetch(p["url"]).decode("utf-8", "replace"); src = pick(t); via = "live"
        except Exception as e: via = "live-failed:%s" % e
    if not src: res[p["id"]] = {"none": True, "why": ("Sika publishes no packshot for this product; the page has only diagrams, application or system images (not a product picture), so none was taken" if re.search(r"https://pim2\.sika\.com/\S+?\.(?:png|jpg)", html.unescape(t or "")) else "Sika publishes no product image on this page (checked the cached page and a live fetch; only the site logo and icons are present)")}; continue
    ok = True
    for w in (480, 960):
        path = os.path.join(OUT, "%s-%d.webp" % (p["id"], w))
        if os.path.exists(path): continue
        u = sized(src, w)
        try:
            if u not in bycache: polite(); bycache[u] = fetch(u)
            webp(bycache[u], path, w)
        except Exception as e:
            ok = False; res[p["id"]] = {"none": True, "why": "download failed %s: %s" % (u, e)}; break
    if ok: res[p["id"]] = {"source": src["base"], "kind": src["kind"], "via": via}
json.dump(res, open(os.path.join(here, "images_source.json"), "w"), indent=0, sort_keys=True)
print("with", sum(1 for v in res.values() if "source" in v), "without", sum(1 for v in res.values() if v.get("none")))
