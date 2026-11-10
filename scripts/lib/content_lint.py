# VENDORED COPY of klinge-kernel bin/content_lint.py @ 9a86bc6fc8 (2026-11-06) so scripts/test_c9proof.mjs runs on any machine. Re-sync by copy; do not edit here.
#!/usr/bin/env python3
"""content_lint.py — the gate every public piece must pass before it can be put up for approval.

Kyle, 2026-10-01: "there's got to be no AI tells. So no weird hyphens. Everything has to be good human English,
professional and structured... everything needs to follow my sales copy... everything needs to come back to
making money."

FAIL on:
  - any em dash (—) or en dash (–) in the prose (use a comma, a full stop, "to" for ranges, or brackets)
  - AI-tell words (same list as send_pack.py TELLS, plus a few openers)
  - stock AI phrasings ("it's not just X, it's Y", "in today's", "let's dive in", "in conclusion", ...)
  - no call to action (a public piece must end on a next step that leads to money: free scan / audit call / pack)
Code fences, HTML comments and URLs are ignored. Usage: content_lint.py [--no-cta] [--figures] FILE... (exit 0 = all clean)
"""
import re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
try:
    from send_pack import TELLS
except Exception:
    TELLS = re.compile(r"\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*)\b", re.I)

PHRASES = re.compile(r"(it'?s not (just|only) [^.]{1,60}, it'?s|in today'?s|let'?s dive|dive into|in conclusion|"
                     r"it'?s important to note|it'?s worth noting|game[- ]changer|unlock(ing)? the power|"
                     r"navigat(e|ing) the (complex|ever)|tapestry|testament to|at the end of the day|"
                     r"whether you'?re a|look no further|elevate your|embark on)", re.I)
CTA = re.compile(r"(free scan|free audit|audit call|book (a|an|your)|titanos\.tech/(scan|contact|order|audit)|"
                 r"get (your|a) (free|report|scan)|call (me|us)|reply to|start (your|a) free)", re.I)


FIG = re.compile(r"(?:AU|US)?\$\s?\d[\d,.]*\s?(?:k|m|bn|million|billion)?\b|\b\d[\d,.]*\s?(?:%|per cent|percent)", re.I)
LABEL = re.compile(r"\b(MODELLED|MODELED|VERIFIED|OBSERVED|REALIZED|REALISED|INFERRED|TESTED|UNKNOWN|ESTIMATE[D]?|scenario|sources?|sourced|filed accounts|annual report|ACNC|ABS|AusTender|study|survey|report|measured|sampled|according to|PROPOSED|Tranco|public DNS)\b|https?://", re.I)
PRICE = re.compile(r"\(AU\$[\d,]+, [a-z -]+\)|\bPrice\b|AU\$[\d,]+ (?:a|per) (?:month|year)|\bcatalogue\b", re.I)   # our own list prices are offers, not claims


def unfigured(text: str):
    """-> (figure paragraphs, unsourced ones). A paragraph with a $/% figure must carry a label, a named source or a URL."""
    fig = bad = 0
    for para in re.split(r"\n\s*\n", text):
        if FIG.search(para) and not PRICE.search(para):
            fig += 1
            if not LABEL.search(para):
                bad += 1
    return fig, bad


def strip(text: str) -> str:
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    text = re.sub(r"`[^`\n]*`", " ", text)
    return re.sub(r"https?://\S+", " ", text)


def lint(text: str, need_cta: bool = True, figures: bool = False) -> list[str]:
    body, problems = strip(text), []
    if figures:   # opt-in (content_daily): a published number must name where it came from
        fig, bad = unfigured(body)
        if bad:
            problems.append(f"{bad} of {fig} paragraphs carry a number with no source, MODELLED/VERIFIED label or link")
    for ch, name in (("—", "em dash"), ("–", "en dash")):
        n = body.count(ch)
        if n:
            ln = next(i for i, l in enumerate(body.splitlines(), 1) if ch in l)
            problems.append(f"{n} {name}(es), first on line {ln}")
    tells = sorted({m.group(0).lower() for m in TELLS.finditer(body)})
    if tells:
        problems.append("AI-tell words: " + ", ".join(tells))
    phr = sorted({m.group(0).lower() for m in PHRASES.finditer(body)})
    if phr:
        problems.append("AI-tell phrasing: " + ", ".join(phr))
    if need_cta and not CTA.search(text):
        problems.append("no call to action (free scan / audit call / book / titanos.tech link)")
    return problems


def main(argv) -> int:
    no_cta = "--no-cta" in argv
    figures = "--figures" in argv
    files = [a for a in argv if not a.startswith("--")]
    bad = 0
    for f in files:
        probs = lint(Path(f).read_text(errors="replace"), need_cta=not no_cta, figures=figures)
        print(("CLEAN " if not probs else "FAIL  ") + f + ("" if not probs else "\n   - " + "\n   - ".join(probs)))
        bad += bool(probs)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
