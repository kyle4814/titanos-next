#!/usr/bin/env python3
"""Parity driver for scripts/test_xray_lint.mjs. Runs the PYTHON claim lint and engine on cases read from stdin.
Usage: xray_lint_py_driver.py <klinge-kernel root holding bin/mf_xray.py + bin/mf_claim_lint.py + docs/money_factory/mf6>
stdin JSON: {"lint": [str], "docs": [input doc]}   stdout JSON: {"lint": [[rule,...]], "docs": ["accept"|"refuse"]}
Offline, stdlib only, reads the given source tree only."""
import json
import os
import sys

root = sys.argv[1]
sys.path.insert(0, os.path.join(root, "bin"))
import mf_claim_lint as L  # noqa: E402
import mf_xray as X  # noqa: E402

req = json.load(sys.stdin)
out = {"lint": [], "docs": []}
for s in req["lint"]:
    out["lint"].append(sorted({f["rule"] for f in L.lint_markdown("SYNTHETIC DEMO\n\n" + s)} | {f["rule"] for f in L.lint_json(s)}))
for d in req["docs"]:
    try:
        X.generate(d)
        out["docs"].append("accept")
    except X.XrayError:
        out["docs"].append("refuse")
json.dump(out, sys.stdout)
