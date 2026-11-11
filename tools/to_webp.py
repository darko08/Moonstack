"""Pretvara originale iz art/originals u wiki/img/*.webp (do 1600 px). Ručne ispravke (_fixed, _v2) i isečci su već primenjeni u wiki/img."""
import os, sys
from PIL import Image

src, dst = 'art/originals', 'wiki/img'
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'):
        continue
    im = Image.open(os.path.join(src, f)).convert('RGB')
    w, h = im.size
    s = min(1, 1600 / max(w, h))
    if s < 1:
        im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
    out = os.path.join(dst, f[:-4] + '.webp')
    if os.path.exists(out) and '--force' not in sys.argv:
        continue
    im.save(out, 'WEBP', quality=84)
    print(out)
