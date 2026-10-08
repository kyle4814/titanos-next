#!/usr/bin/env python3
"""W6 text gates over the built site. Usage: qa_text_gates.py <outDir> <textDir> <kernelDir>
1) doctrine-leak: any 8-word shingle of CORE.md / LEXICON.md (spec scope; SOUL.md excluded because the spec mandates public lines from it) rule text found in built HTML/JS/text = FAIL.
2) content_lint (no-CTA mode) over every route's visible text."""
import re, sys
from pathlib import Path
out, textdir, kernel = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
sys.path.insert(0, str(kernel / "bin"))
norm = lambda s: re.sub(r"[^a-z0-9 ]+", " ", s.lower())
def words(s): return norm(s).split()
shingles = {}
for name in ("CORE.md", "LEXICON.md"):
    p = kernel / name
    if not p.exists(): continue
    for line in p.read_text(errors="ignore").splitlines():
        line = re.sub(r"^[A-Z]+\d*\s+", "", line.strip())
        w = words(line)
        for i in range(max(0, len(w) - 7)):
            shingles.setdefault(" ".join(w[i:i + 8]), name)
leaks = []
for f in list(out.rglob("*.html")) + list(out.rglob("*.js")) + list(out.rglob("*.txt")) + list(textdir.glob("*.txt")):
    t = " ".join(words(re.sub(r"<[^>]+>", " ", f.read_text(errors="ignore"))))
    for sh, src in shingles.items():
        if sh in t:
            leaks.append((str(f.relative_to(out) if out in f.parents else f), src, sh)); break
print("DOCTRINE LEAKS:", len(leaks))
for l in leaks[:20]: print("  ", l)
from content_lint import lint
bad = 0
for f in sorted(textdir.glob("*.txt")):
    pr = lint(f.read_text(errors="ignore"), need_cta=False)
    if pr:
        bad += 1; print("LINT", f.name, [str(x)[:90] for x in pr[:3]])
print("LINT FAILING PAGES:", bad)
