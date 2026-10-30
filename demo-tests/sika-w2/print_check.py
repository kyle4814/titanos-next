#!/usr/bin/env python3
"""Real Chrome print-to-PDF for every sheet (or the slugs given), page counts via PyMuPDF. Writes tests/print_pages.json.
usage: print_pages.py [slug ...]   (needs a built preview/ folder; starts and stops its own http.server)"""
import json, os, subprocess, sys, time, threading, queue, shutil
from pathlib import Path
import pymupdf
HERE = Path(__file__).resolve().parent; SYS = Path('/home/tech2/klinge-kernel/state/sika/systems')
PV = Path(os.environ.get('PV', '/home/tech2/kk-a-demo-sika/public/demo/sika-210c0c'))  # the portal folder itself (final copy of print_pages.py)
PORT = int(os.environ.get('PRINT_PORT', '47853'))
sys.path.insert(0, str(SYS)); import build_systems as _b; EST = _b.ESTIMATE
CHROME = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
WBASE = 'C:\\Users\\tech2\\AppData\\Local\\Temp\\kk_print_w2site'; LBASE = Path('/mnt/c/Users/tech2/AppData/Local/Temp/kk_print_w2site')
slugs = sys.argv[1:] or sorted(p.parent.name for p in (PV / 'systems').glob('*/index.html') if p.parent.name != 'systems')
(LBASE / 'pdf').mkdir(parents=True, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=PV, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
res = {}; q = queue.Queue(); [q.put(s) for s in slugs]
def worker(i):
    while True:
        try: s = q.get_nowait()
        except queue.Empty: return
        pdf = LBASE / 'pdf' / f'{s}.pdf'
        if pdf.exists(): pdf.unlink()
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', f'--user-data-dir={WBASE}\\w{i}', f'--print-to-pdf={WBASE}\\pdf\\{s}.pdf', f'http://localhost:{PORT}/systems/{s}/?m2=40'], capture_output=True, timeout=120)
        try:
            d = pymupdf.open(pdf); txt = ''.join(p.get_text() for p in d); res[s] = {'pages': len(d), 'estimate': EST in txt, 'qty': 'You need' in txt or 'Packs:' in txt}
        except Exception as e: res[s] = {'pages': None, 'error': str(e)[:80]}
try:
    ts = [threading.Thread(target=worker, args=(i,)) for i in range(4)]
    [t.start() for t in ts]; [t.join() for t in ts]
finally:
    srv.terminate()
dist = {}
for v in res.values(): k = v['pages'] if v['pages'] is None or v['pages'] <= 2 else '3+'; dist[str(k)] = dist.get(str(k), 0) + 1
out = {'m2': 40, 'sheets': len(res), 'distribution': dict(sorted(dist.items())), 'worst': sorted(((v['pages'] or 99, s) for s, v in res.items()), reverse=True)[:10], 'results': dict(sorted(res.items()))}
if len(sys.argv) == 1: pass
print(json.dumps({k: out[k] for k in ('sheets', 'distribution', 'worst')}))
