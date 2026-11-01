#!/usr/bin/env python3
"""Page counts of the quote-request PDFs that e2e_sales.mjs prints with real Chrome (page.pdf with the print stylesheet).
Each must be ONE page (a request of 19 to 30 lines may run to a second or third page, in normal type (30 lines of worst-case 100-character coverage lines measured at 3)), carry the estimate sentence and the reference, and show no price. usage: print_pages.py [dir]"""
import json, re, sys
from pathlib import Path
import pymupdf
D = Path(sys.argv[1] if len(sys.argv) > 1 else '/mnt/c/Users/tech2/AppData/Local/Temp/kk_sales_pdf')
EST = 'Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.'
res = {}; bad = []
for pdf in sorted(D.glob('*.pdf')):
    d = pymupdf.open(pdf); txt = ''.join(p.get_text() for p in d); flat = re.sub(r'\s+', ' ', txt)
    r = {'pages': len(d), 'estimate': EST in flat, 'ref': bool(re.search(r'SQ-\d{8}-[0-9A-Z]{4}', txt)), 'banner': "it is not sent to Sika's systems from here" in flat, 'price': bool(re.search(r'\$\s?\d', txt)), 'chars': len(txt)}
    m = re.match(r'lines_(\d+)', pdf.name); cap = (3 if int(m.group(1)) > 25 else 2) if m and int(m.group(1)) > 18 else 1
    res[pdf.name] = r
    if r['pages'] > cap or r['pages'] < 1 or not (r['estimate'] and r['ref'] and r['banner']) or r['price']: bad.append(pdf.name)
print(json.dumps(res, indent=1)); print('ONE PAGE PROOF:', len(res), 'pdfs,', len(bad), 'failed', bad if bad else '')
sys.exit(1 if bad or not res else 0)
