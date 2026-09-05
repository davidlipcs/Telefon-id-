# Telefon-id-
Gyerek zar es ido ha tanult

## Kredit — prototípus

`kredit.html` — egyfájlos, vanilla JS prototípus. Nincs build lépés, nincs
framework, **nincs API és nincs hálózati függés**: nyisd meg böngészőben, és megy.
Mobilra tervezve.

**Az alapötlet:** a játékidőt ki kell tanulni. Reggel beállítasz egy alapkeretet,
efölé csak úgy jutsz, hogy leírod, amit tanultál, az app kikérdez belőle, és a
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

### A kikérdező — helyben fut

Nincs fotó és nincs modellhívás. A gyerek leírja (vagy a billentyűzet mikrofonjával
bediktálja), amit tanult, legalább 200 karakterben, és az app ebből készít kérdést:

1. Mondatokra bontás, majd kulcsszó-kiemelés mondatonként — szám, tulajdonnév,
   hosszú tartalmas szó, ebben a sorrendben.
2. **Kiegészítős kérdés:** a kulcsszó helyére `_____` kerül.
3. **Mondatválasztós kérdés:** minden harmadik körben négy majdnem azonos mondat,
   háromban ki van cserélve egy szó.
4. A zavaró válaszok ugyanannak a szövegnek a többi kulcsszavából jönnek, azonos
   fajtából, lehetőleg **azonos végződéssel** — hogy ne a magyar toldalék árulja el
   a jó megoldást —, és soha nem olyan szó, ami a látható mondatban már ott áll.
5. A kérdések a szöveg egészét lefedik, nem csak az elejét.
6. A téma megnevezése szótő-közelítéssel (a szó első 6 karaktere) áll elő, mert a
   magyar toldalékol: „körforgás" és „körforgásának" ugyanaz a téma.

Cserébe ez **felidézést mér, nem megértést** — ezt egy nyelvi modell tudná, az meg
API-t jelentene. A leírás viszont maga is tanulás, úgyhogy a hurok nem üresedik ki.

### Csalás ellen

- A leírt szöveg nem látszik a kikérdezés alatt.
- Kérdésenként visszaszámláló (alapból 25 mp); lejáratkor a kérdés rossz.
- Nincs visszalépés, a válasz végleges.
- `perc = jó válaszok × perCorrect`, de `minCorrect` alatt **nulla**. Napi plafon: `cap`.
- **Ugyanaz a szöveg naponta egyszer fizet** — a napló őrzi a szöveg ujjlenyomatát.
- A napló rögzíti a szöveg hosszát, és a szülői nézetben az első 160 karakterét is,
  így a bemásolt halandzsa kilóg.
- A sikertelen kör is bekerül a naplóba.

### Android app

A `android/` mappában ott a natív réteg, ami böngészőben nem megoldható: magától
elindul, a háttérben fut, és tényleg lezárja a játékot. A felület ugyanez a
`kredit.html`, WebView-ban — a build másolja be, tehát egy forrás van, nem kettő.
A részletek: [`android/README.md`](android/README.md).

Röviden: a figyelő kisegítő szolgáltatásként fut (a rendszer indítja
bekapcsoláskor, nem lövi ki), az ablakváltásokból tudja, melyik app van
előtérben, percenként vonja a keretet, nullánál kiteszi az appot az előtérből és
panelt mutat. A `kredit.html` tárolóadaptere Androidon a natív hídon keresztül
ír, hogy a szolgáltatás akkor is lássa a keretet, amikor a felület nem fut.
Hálózati engedélye az appnak nincs.

### Amit tudni kell a korlátairól

- **A böngésző nem tud játékot blokkolni.** Ehhez az `android/` mappában lévő
  natív app kell. A HTML önmagában becsületkassza.
- Az Android projekt **nincs lefordítva** — ahol készült, ott nincs Android SDK.
  A forrás teljes, az erőforrás-hivatkozások ellenőrizve, de az első fordítás
  hozhat olyan hibát, amit csak a fordító talál meg.
- **A párosítás itt megosztott tárolón megy.** Élesben Firebase Auth + Firestore.
- Ha nincs `window.storage`, a fájl `localStorage`-ra esik vissza. Ekkor a
  „megosztott" tár is csak az adott eszközön él, vagyis a szülő–gyerek párosítás
  egy gépen belül demózható.
- Az egyetlen külső kérés a Google Fonts, tisztán kozmetikai; ha nem tölt be,
  rendszerbetűkkel fut tovább.

### Publikálás

A `kredit.html` teljes dokumentum, önmagában megnyitható. Artifactként publikálva a
burkoló tageket a platform adja hozzá, ezért ott a tartalom kell nélkülük:

```
node build-artifact.mjs > kredit-artifact.html
```

### Teszt

Fejnélküli füstteszt Playwrighttal, 52 ellenőrzés — a generátor önmagában
(4 különböző válasz, a jó válasz a szövegből jön, a zavaró válasz nem látszik a
mondatban — 40 lefutáson át ellenőrizve), a jutalomszámolás, a minimum-szabály, az
ismételt szöveg blokkolása, a napló, a játékóra percenkénti fogyása, a PIN-zár
újratöltés után, a párosítás, a szerepenkénti fülek, és egy blokk, ami **minden
külső kérést eldob**, hogy bizonyítsa: a teljes kör hálózat nélkül is végigmegy.

```
npx http-server -p 8099 -s .
node smoke.mjs
```
