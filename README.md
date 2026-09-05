# Telefon-id-
Gyerek zar es ido ha tanult

## Kredit — prototípus

`kredit.html` — egyfájlos, vanilla JS prototípus. Nincs build lépés, nincs
framework: nyisd meg böngészőben, és megy. Mobilra tervezve.

**Az alapötlet:** a játékidőt ki kell tanulni. Reggel beállítasz egy alapkeretet,
efölé csak úgy jutsz, hogy lefotózod a tanult oldalt, az app kikérdez belőle, és a
**helyes válaszokért** kapsz plusz perceket. Játék közben ketyeg az idő, nullánál
a játékok zárolva.

### Három üzemmód

| Mód | Tár | Fülek |
|---|---|---|
| **Szóló** | privát (`kredit-solo`) | Ma · Tanulás · Játék · Szabályok (opcionális PIN mögött) |
| **Szülő** | megosztott (`kredit-fam-<KÓD>`) | Napló · Szabályok (PIN kötelező) |
| **Gyerek** | megosztott (`kredit-fam-<KÓD>`) | Ma · Tanulás · Játék |

A gyerek eszközén a Szabályok fül **nincs a felületen** — nem PIN takarja el. A
szabályok a szülő rekordjában élnek. Írásnál mindkét eszköz csak a saját mezőit
menti (szülő: `settings`/`timetable`/`games`, gyerek: `days`/`tests`/`lastTestAsk`),
friss visszaolvasás után, hogy ne írják felül egymást.

### Csalás ellen

- A kikérdezés alatt a kép nem látszik.
- Kérdésenként visszaszámláló (alapból 25 mp); lejáratkor a kérdés rossz.
- Nincs visszalépés, a válasz végleges.
- `perc = jó válaszok × perCorrect`, de `minCorrect` alatt **nulla** — így nem éri
  meg a legüresebb oldalt lefotózni. Napi plafon: `cap`.
- A sikertelen kör is bekerül a naplóba.

### Amit tudni kell a korlátairól

- **A böngésző nem tud játékot blokkolni.** Élesben ez natív Android réteg:
  UsageStatsManager + overlay + foreground service.
- **A párosítás itt megosztott tárolón megy.** Élesben Firebase Auth + Firestore.
- Ha nincs `window.storage`, a fájl `localStorage`-ra esik vissza, hogy önmagában
  is futtatható legyen. Ekkor a "megosztott" tár is csak az adott eszközön él,
  vagyis a szülő–gyerek párosítás egy gépen belül demózható.
- **API kulcs sehol nincs a kliensben** — se beégetve, se beírható mezőben. A
  kikérdező kulcs nélkül hívja az Anthropic API-t, amit a gazdakörnyezet kezel.
  Élesben ugyanez a felállás: a kulcs a backenden marad, a telefon sosem látja.
- Ezért a fotóból csak az éles környezet tud kérdést csinálni. Ha a fájlt csak
  megnyitod, a hívás elbukik, és az app felkínál egy **demó kört** (helyben
  generált kérdések), hogy a teljes hurok — óra, nincs visszalépés, pontozás,
  jutalom, napló — kipróbálható legyen. A demó kör a naplóban jelölve van.

### Teszt

Fejnélküli füstteszt Playwrighttal, 55 ellenőrzés (nap indítása, jutalom-
számolás, minimum-szabály, napló, játékóra, PIN, párosítás, fülek szerepenként,
offline demó kör):

```
npx http-server -p 8099 -s .
node smoke.mjs
```
