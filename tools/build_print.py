"""Pravi build/print.html i build/jpg/*.jpg (JPEG do 1200 px) za PDF. Pokretanje iz korena repoa."""
import os
from PIL import Image

os.makedirs('build/jpg', exist_ok=True)
for f in os.listdir('wiki/img'):
    im = Image.open(os.path.join('wiki/img', f)).convert('RGB')
    w, h = im.size
    s = min(1, 1200 / max(w, h))
    if s < 1:
        im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
    im.save(os.path.join('build/jpg', f.replace('.webp', '.jpg')), 'JPEG', quality=72, optimize=True)
html = open('wiki/index.html', encoding='utf-8').read()
html = html.replace('img/', 'jpg/').replace('.webp', '.jpg').replace(' loading="lazy"', '')
open('build/print.html', 'w', encoding='utf-8').write(html)
print('build/print.html spreman')
