#!/usr/bin/env python3
"""Decodes the QR from the PRINTED sheets: renders page 1 of each print_check.py PDF at 150 dpi (about a phone photo of a printout), finds the code in the top right
and decodes it with jsQR (node). Proves the printed code, not just the SVG, scans, and that its address is the sheet's own. usage: print_decode.py [pdfDir] [portalDir]"""
import json, os, subprocess, sys, tempfile
import pymupdf
HERE = os.path.dirname(os.path.abspath(__file__))
PDFS = sys.argv[1] if len(sys.argv) > 1 else '/mnt/c/Users/tech2/AppData/Local/Temp/kk_print_w2site/pdf'
BASE = os.environ.get('QR_BASE', 'https://preview.sika-preview.pages.dev/')
NM = '/home/tech2/titanos_launch/titanos-next/node_modules'
tmp = tempfile.mkdtemp(prefix='printdecode-')
if not tmp or 'printdecode-' not in tmp: sys.exit('no fixture dir')
names = sorted(f[:-4] for f in os.listdir(PDFS) if f.endswith('.pdf')); items = []
for n in names:
    d = pymupdf.open(os.path.join(PDFS, n + '.pdf')); p = d[0]; r = p.rect
    clip = pymupdf.Rect(r.width * 0.6, 0, r.width, r.height * 0.22)      # the top right corner of the page
    pm = p.get_pixmap(dpi=150, clip=clip, colorspace=pymupdf.csGRAY)
    f = os.path.join(tmp, n + '.gray'); open(f, 'wb').write(pm.samples); items.append([n, pm.width, pm.height, f])
js = f"""const {{createRequire}}=require('module');const req=createRequire('{NM}/x.js');const jsQR=req('jsqr');const fs=require('fs');
const items=JSON.parse(fs.readFileSync(process.argv[2]));const out={{}};
for(const [n,w,h,f] of items){{const g=fs.readFileSync(f);const px=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){{px[i*4]=px[i*4+1]=px[i*4+2]=g[i];px[i*4+3]=255}}const r=jsQR(px,w,h);out[n]=r?r.data:null}}
console.log(JSON.stringify(out));"""
open(os.path.join(tmp, 'items.json'), 'w').write(json.dumps(items)); open(os.path.join(tmp, 'dec.cjs'), 'w').write(js)
try:
    pr = subprocess.run(['node', os.path.join(tmp, 'dec.cjs'), os.path.join(tmp, 'items.json')], capture_output=True, text=True)
    if pr.returncode: sys.exit('node failed: ' + pr.stderr[:600])
    res = json.loads(pr.stdout)
finally:
    for f in os.listdir(tmp): os.unlink(os.path.join(tmp, f))
    os.rmdir(tmp)
bad = [n for n in names if res.get(n) != f'{BASE}#/ask?system={n}']
print(f'PRINTED QR: {len(names) - len(bad)} of {len(names)} printed sheets scan to their own address' + (' ; first misses: ' + ', '.join(bad[:3]) if bad else ''))
sys.exit(1 if bad or not names else 0)
