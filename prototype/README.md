# Moonstack prototip: jedan kraj, jedan Mesec

Igrivi prototip jezgra igre za desktop: gradnja spratova, statika sa skelama (Leverage), Margin Call, Liquidation i Tower Fall. Jedan kraj sa 9 kula (ti i 8 botova), jedan lunarni ciklus, oko 15 minuta na 1×.

## Pokretanje

```bash
python3 -m http.server 8770
# otvori http://localhost:8770/prototype/index.html
```

## Fajlovi

| Fajl | Šta je |
|---|---|
| `engine.js` | Sva logika igre, bez DOM-a. Radi u browseru i u Node-u. |
| `index.html` | Ekran: skyline kraja na kanvasu, statika, gradnja, vojska, meta, log. |
| `sim.js` | Simulacija bez ekrana za proveru balansa: `node prototype/sim.js 30` |

## Šta prototip treba da pokaže

1. Da li igrači biraju rizik (skele) ili rastu sigurno ispod linije.
2. Da li je rušenje uzbudljivo ili frustrirajuće.

## Razlike u odnosu na wiki

Brojevi su podešeni za jednu kratku sesiju, pa se razlikuju od wikija:

- Sezona je jedan ciklus (29,53 dana), a Moonline pada sa 825 m na 225 m.
- Svi imaju osnovnih 150 Bricks dnevno, uz 40 po Mason-u.
- Floor price: Bricks 200 × 1,09ⁿ, Stone 300 × 1,11ⁿ.
- Nema senki, mostova, vazdušnih jedinica, tržišta ni koalicija.

## Balans titula (posle prve runde)

- **Wolf i Moon-Eater:** jedinice su skuplje (×1,2 i ×1,35), botovi ih češće biraju za metu, a male titule (Moth, Toad, Hare) imaju +12% šanse za pogodak protiv njih.
- **Moth:** Dust Nets +25%, +2 mesta za jedinice, sapperi kreću već od 2. Noćni napad je Hidden Raid: +20% uspeha, manji gubici i pljačka 6% do 18% Bricks, Stone i Moondust-a mete. Botovi ga retko gađaju dok je ispod 160 m.
