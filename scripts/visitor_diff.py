#!/usr/bin/env python3
"""visitor_diff.py - what a visitor gains and loses between two built sites, in plain lines for a deploy card.

Born 2026-11-11: a deploy card said "homepage 40.6 -> 11.6 phone screens" but not that every price left the home page
(68 AU$ mentions -> 6). A card must say what DISAPPEARS, not only the size.

  visitor_diff.py OLD NEW [--max-lines N] [--max-headings N]
OLD / NEW are each a built out/ directory, or `gh-pages:<ref>` (e.g. gh-pages:origin/gh-pages), which is exported with
git archive from the repo in --repo (default: the current directory). Read-only; nothing is built, pushed or sent.
Per page (every .html file outside _next): headings (h1-h3) added and removed, and the change in "AU$" price mentions.
Exit 0 always when it ran (a diff is information, not a verdict); 2 on a bad argument.
"""
import argparse, io, os, re, subprocess, sys, tarfile, tempfile
from html.parser import HTMLParser

SKIP = {"script", "style", "noscript", "template"}


class _Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.headings, self.text, self._skip, self._h = [], [], 0, None

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self._skip += 1
        elif tag in ("h1", "h2", "h3") and not self._skip:
            self._h = []

    def handle_endtag(self, tag):
        if tag in SKIP and self._skip:
            self._skip -= 1
        elif tag in ("h1", "h2", "h3") and self._h is not None:
            t = re.sub(r"\s+", " ", "".join(self._h)).strip()
            if t:
                self.headings.append(t)
            self._h = None

    def handle_data(self, data):
        if self._skip:
            return
        self.text.append(data)
        if self._h is not None:
            self._h.append(data)


def read_page(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        p = _Page()
        p.feed(f.read())
    text = " ".join(p.text)
    return {"headings": p.headings, "prices": len(re.findall(r"AU\s*\$", text))}


def scan(root):
    pages = {}
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in ("_next", ".git")]
        for n in fn:
            if n.endswith(".html"):
                rel = os.path.relpath(os.path.join(dp, n), root)
                url = "/" + re.sub(r"(^|/)index\.html$", "", rel).removesuffix(".html")
                pages[url] = read_page(os.path.join(dp, n))
    return pages


def export_ref(repo, ref, dest):
    out = subprocess.run(["git", "-C", repo, "archive", "--format=tar", ref], capture_output=True)
    if out.returncode != 0:
        raise SystemExit(f"visitor_diff: git archive {ref} failed: {out.stderr.decode()[:200]}")
    with tarfile.open(fileobj=io.BytesIO(out.stdout)) as t:
        t.extractall(dest, filter="data")


def resolve(spec, repo, tmp, tag):
    if spec.startswith("gh-pages:"):
        d = os.path.join(tmp, tag)
        os.makedirs(d)
        export_ref(repo, spec.split(":", 1)[1], d)
        return d
    if not os.path.isdir(spec):
        raise SystemExit(f"visitor_diff: {spec} is not a directory")
    return spec


def diff(old, new, max_lines=12, max_headings=3):
    lines = []
    tot_o = sum(p["prices"] for p in old.values())
    tot_n = sum(p["prices"] for p in new.values())
    for url in sorted(set(old) | set(new)):
        o, n = old.get(url), new.get(url)
        if o is None:
            lines.append(f"+ NEW PAGE {url} ({n['prices']} AU$ mentions)")
            continue
        if n is None:
            lines.append(f"- PAGE GONE {url} (had {o['prices']} AU$ mentions)")
            continue
        gone = [h for h in o["headings"] if h not in n["headings"]]
        added = [h for h in n["headings"] if h not in o["headings"]]
        dp = n["prices"] - o["prices"]
        if not (gone or added or dp):
            continue
        parts = []
        if dp:
            parts.append(f"AU$ mentions {o['prices']} -> {n['prices']}")
        for sign, hs in (("removed", gone), ("added", added)):
            if hs:
                shown = "; ".join(f'"{h[:50]}"' for h in hs[:max_headings])
                more = f" +{len(hs) - max_headings} more" if len(hs) > max_headings else ""
                parts.append(f"{sign}: {shown}{more}")
        lines.append(f"{url or '/'}: " + ", ".join(parts))
    head = f"VISITOR DIFF: {len(old)} -> {len(new)} pages, AU$ mentions {tot_o} -> {tot_n}"
    if not lines:
        return [head, "No visible page, heading or price changes."]
    if len(lines) > max_lines:
        lines = lines[:max_lines] + [f"... and {len(lines) - max_lines} more pages changed"]
    return [head] + lines


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("old"); ap.add_argument("new")
    ap.add_argument("--repo", default=".")
    ap.add_argument("--max-lines", type=int, default=12)
    ap.add_argument("--max-headings", type=int, default=3)
    a = ap.parse_args(argv)
    with tempfile.TemporaryDirectory(prefix="vdiff.") as tmp:
        o = scan(resolve(a.old, a.repo, tmp, "old"))
        n = scan(resolve(a.new, a.repo, tmp, "new"))
    print("\n".join(diff(o, n, a.max_lines, a.max_headings)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
