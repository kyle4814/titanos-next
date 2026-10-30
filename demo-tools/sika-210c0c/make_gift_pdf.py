#!/usr/bin/env python3
"""Prints the data quality page (#/about/data-quality?print=1, every list open) to downloads/sika-data-quality-notes.pdf with headless Chrome.
Run after build_gift.mjs. Serves the portal itself on a local port for the run, and stops the server. usage: make_gift_pdf.py [portalDir] [port]"""
import os, shutil, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
PORTAL = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'))
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 47951
CHROME = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
WT = 'C:\\Users\\tech2\\AppData\\Local\\Temp\\kk_giftpdf'; LT = '/mnt/c/Users/tech2/AppData/Local/Temp/kk_giftpdf'
os.makedirs(LT, exist_ok=True); out = os.path.join(PORTAL, 'downloads'); os.makedirs(out, exist_ok=True)
tmp = LT + '/gift.pdf'
if os.path.exists(tmp): os.unlink(tmp)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=PORTAL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=25000', f'--user-data-dir={WT}\\profile', f'--print-to-pdf={WT}\\gift.pdf', f'http://127.0.0.1:{PORT}/#/about/data-quality?print=1'], capture_output=True, timeout=180)
finally:
    srv.terminate()
if not os.path.exists(tmp): sys.exit('no PDF written')
shutil.copyfile(tmp, os.path.join(out, 'sika-data-quality-notes.pdf')); print('wrote', os.path.join(out, 'sika-data-quality-notes.pdf'), os.path.getsize(tmp), 'bytes')
