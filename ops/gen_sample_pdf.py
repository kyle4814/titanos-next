#!/usr/bin/env python3
"""
Generate public/sample-evidence-pack-excerpt.pdf using the S++ two-layer template.

Run: python3 ops/gen_sample_pdf.py
Output: public/sample-evidence-pack-excerpt.pdf

Template: ops/evidence_pack/template.py   (canonical, reusable for every engagement)
Data:     ops/evidence_pack/sample_data.py (real titanos.tech scan — authorised own-infra)
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from evidence_pack.sample_data import SCAN_DATA
from evidence_pack.render import render_pdf


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_path = os.path.join(repo_root, "public", "sample-evidence-pack-excerpt.pdf")
    render_pdf(SCAN_DATA, out_path, mode="sample")


if __name__ == "__main__":
    main()
