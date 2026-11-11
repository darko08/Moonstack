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
