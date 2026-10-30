#!/usr/bin/env python3
"""Polite link re-check for the data-quality page (wave 2). HEAD first, redirects followed so the final address is known, robots.txt
respected, at least 1.1 s between requests to the host (it reuses the crawl's polite.py limiter, shared with every other lane).
Resumable: writes link_check.json after every 25 documents. Usage: check_doc_links.py [limit]
Records per document id: status, final (where it ended up), redirected (the path changed), checked (UTC)."""
import json, os, sys, time
CRAWL = '/home/tech2/klinge-kernel/state/sika/crawl'
sys.path.insert(0, CRAWL)
import polite  # noqa: E402
from urllib.parse import urlsplit, unquote  # noqa: E402
HERE = os.path.dirname(os.path.abspath(__file__))
PORTAL = os.path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c')
docs = json.load(open(os.path.join(PORTAL, 'data', 'documents.json')))
out = os.path.join(HERE, 'link_check.json')
res = json.load(open(out)) if os.path.exists(out) else {}
limit = int(sys.argv[1]) if len(sys.argv) > 1 else 10**9
def norm(u):
    s = urlsplit(u); return (s.netloc.lower(), unquote(s.path).rstrip('/'))
n = 0
for d in docs:
    if d['id'] in res or n >= limit: continue
    r = polite.head(d['url']); n += 1
    fin = r.get('final') or d['url']
    res[d['id']] = {'status': r['status'], 'final': fin, 'redirected': norm(fin) != norm(d['url']) and isinstance(r['status'], int) and r['status'] < 400,
                    'checked': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    if n % 25 == 0: json.dump(res, open(out, 'w'), indent=0, sort_keys=True); print(n, flush=True)
# phase 2: a document that failed on its listed address gets one polite try on the other address forms of the same file (the listed form with and without
# /content/ in the path, and the dms address), as the first crawl did. If one opens, the listed link is recorded as "opens only at a different address".
def alts(d):
    u = d['url']; a = []
    if '/content/dam/' in u: a.append(u.replace('/content/dam/', '/dam/'))
    elif '/dam/dms/' in u: a.append(u.replace('/dam/dms/', '/content/dam/dms/'))
    if d.get('dmsUrl') and d['dmsUrl'] != u: a.append(d['dmsUrl'])
    return a
for d in docs:
    r = res.get(d['id'])
    if not r or (isinstance(r['status'], int) and r['status'] < 400) or 'alt' in r: continue
    r['alt'] = {'tried': [], 'ok': None}
    for u in alts(d):
        x = polite.head(u); r['alt']['tried'].append([u, x['status']])
        if isinstance(x['status'], int) and x['status'] < 400: r['alt']['ok'] = u; break
    r['alt']['checked'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
json.dump(res, open(out, 'w'), indent=0, sort_keys=True); print('done', len(res))
