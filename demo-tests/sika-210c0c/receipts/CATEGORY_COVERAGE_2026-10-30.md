# CATEGORY COVERAGE 2026-10-30 (T01 second category kill test, measured)

Input: knowledge lane rates.json generated 2026-10-30T08:09:28Z (verified facts), portal data/products.json, safety.json, evidence/verify_rejects.jsonl (24 rejected fact ids). Raw column = rate_status 'published' in rates_raw.json (512 products, before the verifier). Raw and verified agree per category when the verifier rejects no product-level rate (it rejected 24 facts in total, none of which changed a product's status in this run).

## Metric (fixed before reading the numbers)

Metric (fixed before the numbers were looked at, not tuned): a product has a COMPLETE CITED USAGE RECORD when
  (a) its product page carries usage statements (products.json usage list not empty), and
  (b) the knowledge lane's VERIFIED output (rates.json) has rate_status 'published' and at least one consumption fact whose
      source carries the exact phrase, a document or page URL and, for a data sheet (PDS/SDS), a page number, and
  (c) that fact was not rejected by the verifier (evidence/verify_rejects.jsonl).
'not published' means the data sheet and product page text has no figure; it does not mean Sika holds none.
A category supports the platform claim only if 70 percent or more of its products are complete (PASS), else FAIL.

## Table

```
category                            prod  usage  raw verified   sds complete   share  label
concrete                              62     62   61       61    57       61   98.4%  PASS
tile-stone-installationsystems        37     37   35       35    36       35   94.6%  PASS
flooring                              69     69   63       63    41       63   91.3%  PASS
structural-strengthening              12     12    9        9     5        9   75.0%  PASS
concrete-repair-protection            42     42   31       31    36       31   73.8%  PASS
grouts-anchoring                      35     35   23       23    21       23   65.7%  FAIL
sealants-adhesives                    63     63   30       30    53       30   47.6%  FAIL
waterproofing                         46     46   16       16    19       16   34.8%  FAIL
roofing                               34     34    5        5     4        5   14.7%  FAIL
landscape-buildingproducts            58     58    0        0     0        0    0.0%  FAIL
transportation                        15     15    0        0    12        0    0.0%  FAIL
marine                                14     14    0        0     9        0    0.0%  FAIL
automotive-aftermarket                13     13    0        0    11        0    0.0%  FAIL
building-components                    6      6    0        0     4        0    0.0%  FAIL
products                               4      4    0        0     0        0    0.0%  FAIL
appliance-and-equipment                2      2    0        0     2        0    0.0%  FAIL
```

## Result

- Tile and stone (the first category): 35 of 37 complete cited usage records = 94.6% (PASS).
- Second category (highest share among categories with 20 or more products, tile and stone excluded): concrete, 61 of 62 = 98.4% (PASS).
- Categories with 20 or more products that pass the 70 percent bar: concrete, tile-stone-installationsystems, flooring, concrete-repair-protection.
- Waterproofing: 16 of 46 = 34.8% (FAIL). Under the bar, so the platform claim shrinks to tile only for waterproofing (restate it, see APPLY_KYLE.md K1).

## Caveats (honest)

- "Not published" means the data sheet text and product page text carry no consumption figure that a machine could read; it does not mean Sika holds none. 130 products carry an "other status" (no data sheet PDF found, or text mentions coverage but no readable figure); they count as not complete.
- The metric counts a record complete when a verified, cited consumption fact exists. It does not judge whether the figure is enough to compute a quantity (that is calc_ready, 379 of 512 per rates.json counts).
- Product categories use the second path segment of the product page category; a product has exactly one.
- The lane output was still regenerating at 18:09 AEST; re-run the tool to refresh. Nothing here is a Sika-confirmed number.

Tests: python3 category_coverage.py --check -> PASS.
