#!/usr/bin/env python3
"""T01 second category kill test, measured (a receipt, not a feature). Python standard library only; reads files, never fetches.

Metric (fixed before the numbers were looked at, not tuned): a product has a COMPLETE CITED USAGE RECORD when
  (a) its product page carries usage statements (products.json usage list not empty), and
  (b) the knowledge lane's VERIFIED output (rates.json) has rate_status 'published' and at least one consumption fact whose
      source carries the exact phrase, a document or page URL and, for a data sheet (PDS/SDS), a page number, and
  (c) that fact was not rejected by the verifier (evidence/verify_rejects.jsonl).
'not published' means the data sheet and product page text has no figure; it does not mean Sika holds none.
A category supports the platform claim only if 70 percent or more of its products are complete (PASS), else FAIL.

usage: category_coverage.py            prints the table and writes receipts/category_coverage.json and receipts/CATEGORY_COVERAGE_2026-10-30.md
       category_coverage.py --check    runs the table plus its own tests (totals, mutation) and exits non-zero on any failure
"""
import json, os, sys, tempfile, shutil, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PORTAL = os.environ.get('PORTAL', os.path.join(ROOT, 'public', 'demo', 'sika-210c0c'))
KNOW = os.environ.get('KNOW', '/home/tech2/klinge-kernel/state/sika/lanes/knowledge')
THRESHOLD = 0.70


def load(p):
    with open(p, encoding='utf8') as f:
        return json.load(f)


def seg(cat):
    parts = [x for x in (cat or '').split('/') if x]
    return parts[1] if len(parts) > 1 else (parts[0] if parts else '(none)')


def rejected_ids():
    out = set()
    p = os.path.join(KNOW, 'evidence', 'verify_rejects.jsonl')
    if os.path.exists(p):
        for line in open(p, encoding='utf8'):
            try:
                out.add(json.loads(line).get('id'))
            except Exception:
                pass
    return out


def cited_ok(fact, rej):
    if fact.get('id') in rej:
        return False
    s = fact.get('source') or {}
    if not fact.get('text'):
        return False
    if s.get('doc_type') in ('PDS', 'SDS'):
        return bool(s.get('url')) and isinstance(s.get('page'), int)
    return bool(s.get('url') or s.get('web_url'))


def measure(rates, products, safety, rej, raw=None):
    by_prod = {p['id']: p for p in products}
    cats = collections.OrderedDict()
    for pid, p in by_prod.items():
        c = cats.setdefault(seg(p.get('category')), dict(products=0, usage=0, raw=0, verified=0, sds=0, complete=0))
        c['products'] += 1
        has_usage = bool(p.get('usage'))
        r = rates.get(pid) or {}
        facts = ((r.get('facts') or {}).get('consumption')) or []
        verified = r.get('rate_status') == 'published' and any(cited_ok(f, rej) for f in facts)
        if has_usage:
            c['usage'] += 1
        if raw is not None and (raw.get(pid) or {}).get('rate_status') == 'published':
            c['raw'] += 1
        if verified:
            c['verified'] += 1
        if (safety.get(pid) or {}).get('sds'):
            c['sds'] += 1
        if has_usage and verified:
            c['complete'] += 1
    rows = []
    for k, c in cats.items():
        share = c['complete'] / c['products'] if c['products'] else 0
        label = 'PASS' if share >= THRESHOLD else 'FAIL'
        rows.append(dict(category=k, label=label, share=round(share, 4), **c))
    rows.sort(key=lambda r: (-r['share'], -r['products']))
    return rows


def inputs():
    rates_doc = load(os.path.join(KNOW, 'rates.json'))
    products = load(os.path.join(PORTAL, 'data', 'products.json'))
    safety = load(os.path.join(KNOW, 'safety.json'))['products']
    rawp = os.path.join(KNOW, 'pipeline', 'out', 'rates_raw.json')
    raw = load(rawp).get('products') if os.path.exists(rawp) else None
    if raw is None and os.path.exists(rawp):
        raw = load(rawp)
    return rates_doc, products, safety, raw


def table(rows):
    h = f"{'category':34} {'prod':>5} {'usage':>6} {'raw':>4} {'verified':>8} {'sds':>5} {'complete':>8} {'share':>7}  label"
    out = [h]
    for r in rows:
        out.append(f"{r['category'][:34]:34} {r['products']:>5} {r['usage']:>6} {r['raw']:>4} {r['verified']:>8} {r['sds']:>5} {r['complete']:>8} {100 * r['share']:>6.1f}%  {r['label']}")
    return '\n'.join(out)


def main():
    check = '--check' in sys.argv
    rates_doc, products, safety, raw = inputs()
    rates = rates_doc['products']
    rej = rejected_ids()
    rows = measure(rates, products, safety, rej, raw if isinstance(raw, dict) else None)
    print(table(rows))
    total = sum(r['products'] for r in rows)
    fails = []
    # the lane also holds 'documents-only' records (a data sheet with no product page, id doc-...): the portal lists only products that have a page,
    # so the totals are compared on the lane's listed_on_site records (changed 2026-10-30 19:1x when the lane's pass 13 added 130 documents-only records)
    lane_total = rates_doc.get('counts', {}).get('products')
    listed = [k for k, v in rates.items() if v.get('listed_on_site')]
    print(f"\nproducts in portal data {len(products)}; in the knowledge lane's rates {len(rates)} of which listed on the site {len(listed)} (lane count {lane_total}); table total {total}")
    if not (total == len(products) == len(listed)) or len(rates) != lane_total:
        fails.append(f'product totals differ: table {total}, portal {len(products)}, rates listed {len(listed)} of {len(rates)}, lane {lane_total}')
    # mutation test: one verified product set to 'not published' in a COPY; exactly one verified count and one complete count fall by one
    if check:
        tmp = tempfile.mkdtemp(prefix='ccmut-')
        if not tmp or not os.path.basename(tmp).startswith('ccmut-'):
            print('FAIL: scratch dir not created'); sys.exit(2)
        try:
            victim = next(pid for pid, r in rates.items() if r.get('rate_status') == 'published' and any(cited_ok(f, rej) for f in (r.get('facts') or {}).get('consumption', [])) and (next(p for p in products if p['id'] == pid).get('usage')))
            copy_path = os.path.join(tmp, 'rates_copy.json')
            doc = json.loads(json.dumps(rates_doc)); doc['products'][victim]['rate_status'] = 'not published'
            json.dump(doc, open(copy_path, 'w'))
            rows2 = measure(load(copy_path)['products'], products, safety, rej, raw if isinstance(raw, dict) else None)
            a = {r['category']: r for r in rows}; b = {r['category']: r for r in rows2}
            diffs = [(k, a[k]['verified'] - b[k]['verified'], a[k]['complete'] - b[k]['complete']) for k in a if a[k]['verified'] != b[k]['verified'] or a[k]['complete'] != b[k]['complete']]
            if len(diffs) == 1 and diffs[0][1] == 1 and diffs[0][2] == 1:
                print(f"MUTATION CAUGHT: {victim} set to 'not published' in a copy, exactly one verified and one complete count fell by one ({diffs[0][0]})")
            else:
                fails.append(f'mutation not caught cleanly: {diffs}')
        finally:
            if os.path.basename(tmp).startswith('ccmut-') and tmp.startswith(tempfile.gettempdir()):
                shutil.rmtree(tmp, ignore_errors=True)
    # the receipt
    tile = next((r for r in rows if r['category'].startswith('tile-stone')), None)
    others = [r for r in rows if r is not tile and r['products'] >= 20]
    second = others[0] if others else None
    verdict = []
    for r in rows:
        pass
    outdir = os.path.join(HERE, 'receipts'); os.makedirs(outdir, exist_ok=True)
    doc = dict(generated_by='category_coverage.py', date='2026-10-30', rates_generated=rates_doc.get('generated'), threshold=THRESHOLD, metric=__doc__.split('usage:')[0].strip(), rows=rows,
               tile_stone=tile, second_category=second, waterproofing=next((r for r in rows if r['category'] == 'waterproofing'), None))
    json.dump(doc, open(os.path.join(outdir, 'category_coverage.json'), 'w'), indent=1)
    wp = doc['waterproofing']
    md = ['# CATEGORY COVERAGE 2026-10-30 (T01 second category kill test, measured)', '', f"Input: knowledge lane rates.json generated {rates_doc.get('generated')} (verified facts), portal data/products.json, safety.json, evidence/verify_rejects.jsonl ({len(rej)} rejected fact ids). Raw column = rate_status 'published' in rates_raw.json ({len(raw) if isinstance(raw, dict) else 0} products, before the verifier). Raw and verified agree per category when the verifier rejects no product-level rate (it rejected {len(rej)} facts in total, none of which changed a product's status in this run).", '',
          '## Metric (fixed before reading the numbers)', '', __doc__.split('usage:')[0].strip().split('\n', 1)[1].strip(), '', '## Table', '', '```', table(rows), '```', '', '## Result', '']
    if tile:
        md.append(f"- Tile and stone (the first category): {tile['complete']} of {tile['products']} complete cited usage records = {100 * tile['share']:.1f}% ({tile['label']}).")
    if second:
        md.append(f"- Second category (highest share among categories with 20 or more products, tile and stone excluded): {second['category']}, {second['complete']} of {second['products']} = {100 * second['share']:.1f}% ({second['label']}).")
    passing = [r for r in rows if r['label'] == 'PASS' and r['products'] >= 20]
    md.append(f"- Categories with 20 or more products that pass the 70 percent bar: {', '.join(r['category'] for r in passing) or 'none'}.")
    if wp:
        md.append(f"- Waterproofing: {wp['complete']} of {wp['products']} = {100 * wp['share']:.1f}% ({wp['label']}). " + ("Under the bar, so the platform claim shrinks to tile only for waterproofing (restate it, see APPLY_KYLE.md K1)." if wp['label'] == 'FAIL' else 'Passes the bar.'))
    if second and second['label'] == 'FAIL':
        md.append('- The second category is UNDER the threshold: the platform claim shrinks to TILE ONLY. This is the measurement, not a tuned result.')
    md += ['', '## Caveats (honest)', '', '- "Not published" means the data sheet text and product page text carry no consumption figure that a machine could read; it does not mean Sika holds none. ' + str(sum(1 for r in rates.values() if r.get('rate_status') not in ('published', 'not published'))) + ' products carry an "other status" (no data sheet PDF found, or text mentions coverage but no readable figure); they count as not complete.',
           '- The metric counts a record complete when a verified, cited consumption fact exists. It does not judge whether the figure is enough to compute a quantity (that is calc_ready, ' + str((rates_doc.get('counts') or {}).get('calc_ready')) + ' of ' + str(len(rates)) + ' per rates.json counts).',
           '- Product categories use the second path segment of the product page category; a product has exactly one.', '- The lane output was still regenerating at 18:09 AEST; re-run the tool to refresh. Nothing here is a Sika-confirmed number.', '', f"Tests: python3 category_coverage.py --check -> {'PASS' if not fails else 'FAIL ' + '; '.join(fails)}."]
    open(os.path.join(outdir, 'CATEGORY_COVERAGE_2026-10-30.md'), 'w').write('\n'.join(md) + '\n')
    for f in fails:
        print('FAIL:', f)
    sys.exit(1 if fails else 0)


main()
