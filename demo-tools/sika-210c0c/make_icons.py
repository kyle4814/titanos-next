#!/usr/bin/env python3
"""Neutral app icons for the install-as-app feature: a dark rounded "P" shape on the portal yellow. Drawn from shapes, so there is no logo and no
image source. Writes assets/img/app/*.png (assets/img is never precached). usage: make_icons.py [portalDir]"""
import os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
PORTAL = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'))
OUT = os.path.join(PORTAL, 'assets', 'img', 'app'); os.makedirs(OUT, exist_ok=True)
YEL, INK = (255, 197, 16), (60, 60, 60)
def icon(size, scale, rounded):
    S = 4 * size; im = Image.new('RGBA', (S, S), YEL + (255,)); d = ImageDraw.Draw(im)
    u = S * scale / 100.0; ox = oy = S * (1 - scale / 100.0) / 2   # glyph box is scale% of the canvas, centred
    # bowl: ring on top right, stem on the left; coordinates are percentages of the glyph box
    def P(x, y): return (ox + u * x / 100.0, oy + u * y / 100.0)
    d.rectangle([*P(14, 4), *P(38, 96)], fill=INK)                       # stem
    d.pieslice([*P(14, 4), *P(92, 66)], -90, 90, fill=INK)               # bowl outer (right half) 
    d.rectangle([*P(14, 4), *P(53, 66)], fill=INK)
    d.pieslice([*P(38, 22), *P(72, 48)], -90, 90, fill=YEL)              # counter (hole)
    d.rectangle([*P(38, 22), *P(55, 48)], fill=YEL)
    im = im.resize((size, size), Image.LANCZOS)
    if rounded:
        m = Image.new('L', (size, size), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 6, fill=255)
        bg = Image.new('RGBA', (size, size), (0, 0, 0, 0)); bg.paste(im, (0, 0), m); im = bg
    return im
for name, size, scale, rounded in [('icon-192.png', 192, 62, True), ('icon-512.png', 512, 62, True), ('icon-maskable-512.png', 512, 46, False), ('apple-touch-icon.png', 180, 62, False)]:
    icon(size, scale, rounded).save(os.path.join(OUT, name), optimize=True); print(name, os.path.getsize(os.path.join(OUT, name)), 'bytes')
