# Moonstack

**Sagradi kulu do Meseca. Svi vide koliko si visok, i svi žele da te sruše.**

Moonstack je 4X strategija za pregledač i telefon. Tvoj grad je jedna kula u vertikalnom preseku. Mesec se tokom sezone od tri lunarna ciklusa spušta, a kule koje ga dodirnu na Perigee Night „slete na Mesec“.

Portfolio: Brinehold ide u dubinu, Moonstack u visinu, Thawline kroz vreme.

## Sadržaj

| Putanja | Šta je |
|---|---|
| `wiki/index.html` | Wiki igre: 12 poglavlja, 3 interaktivna mockupa (statika sa skelama, senka preko kraja, Wen Moon) |
| `wiki/img/` | Slike za wiki (webp, do 1600 px): key art, 7 titula, 3 scene, 16 UI ekrana |
| `art/originals/` | Originalni PNG iz Runway-a, uključujući ponovljene (`_v2`) i ručno ispravljene (`_fixed`) verzije |
| `docs/Moonstack-wiki.pdf` | PDF wikija, A4, svako poglavlje na novoj strani |
| `tools/` | Skripte za webp, print verziju i PDF |

Objavljeni wiki: https://claude.ai/artifact/L6jMoyYeNZ7VwWuq2Y85Pt (privatan, deli se preko Share menija).

## Lokalni pregled

```bash
python3 -m http.server 8765
# otvori http://localhost:8765/wiki/index.html
```

## Ponovna izrada PDF-a

Potrebni su Python sa Pillow-om i Node sa Playwright-om (Chromium).

```bash
python3 -m http.server 8765 &
python3 tools/build_print.py
node tools/make_pdf.js
```

## Napomene

- Slike su generisane u Runway-u: 30 generisanja, 600 kredita.
- Tekst na UI ekranima je proveren. Tri ekrana su ponovljena, dve sitne greške su ručno ispravljene, a browser okviri isečeni.
- Wiki je na srpskom; nazivi u igri (titule, zgrade, jedinice, mehanike, UI) su na engleskom.
