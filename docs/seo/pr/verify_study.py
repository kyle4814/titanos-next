#!/usr/bin/env python3
"""Recompute the ANZ SMB email-security 'double gap' tallies from the per-band source reports.
Source files (klinge-kernel/state/research/d89e1778/ocean/deep3/), numerators and denominators as each report states them.
Run: python3 -I verify_study.py"""
bands = [  # (Tranco .com.au rank band, source file, double-gap n, live sample N, line quoted in the source)
    ("900k-1,000k", "Q08_securitytxt_gap_au_leads.md", 21, 39, "Q08 says 21 of 40 (52.5%); Q30 and Q32 restate it as 21/39 (53.8%); 21 table rows marked double-gap"),
    ("800k-900k", "Q30_securitytxt_gap_batch3.md", 22, 43, "line 10: 22 of 43 live sampled (51.2%); 45 sampled"),
    ("700k-800k", "Q32_securitytxt_gap_batch4.md", 21, 39, "line 10: 21 of 39 live sampled (53.8%); 40 sampled"),
    ("600k-700k", "Q37_securitytxt_gap_batch5.md", 22, 40, "line 10: 22 of 40 (55.0%)"),
    ("500k-600k", "Q43_securitytxt_gap_batch6.md", 15, 40, "line 12: 15 of 40 (37.5%)"),
    ("400k-500k", "Q47_securitytxt_gap_batch7.md", 16, 37, "line 13: 16 of 37 live (43.2%); 16/40 = 40.0% with 3 dead domains kept"),
    ("300k-400k", "Q51_securitytxt_gap_batch8.md", 20, 40, "line 75: 20 of 40 (50.0%), recounted independently"),
    ("200k-300k", "Q55_securitytxt_gap_batch9.md", 16, 40, "line 90: 16 of 40 (40.0%)"),
]
n = sum(b[2] for b in bands); N = sum(b[3] for b in bands)
for b in bands: print(f"{b[0]:>12}  {b[2]:>3}/{b[3]:<3} {100*b[2]/b[3]:5.1f}%  {b[1]}")
print(f"RECOMPUTED pooled: {n}/{N} = {100*n/N:.1f}%")
print("PUBLISHED pooled (blog + stat report): 172/362 = %.1f%%" % (100*172/362))
print("MATCH" if (n, N) == (172, 362) else "MISMATCH: published pooled counts do not reconcile with the per-band reports")
