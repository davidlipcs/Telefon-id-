# Kredit — Android app

Ez az a réteg, amit böngészőben nem lehet megcsinálni: **magától elindul, a
háttérben fut, és tényleg lezárja a játékot.** A felület ugyanaz a `kredit.html`,
ami a repó gyökerében van — egy forrás, nem két másolat: a build másolja be az
assetek közé.

## Hogyan zárol

A figyelő **kisegítő szolgáltatásként** (`AccessibilityService`) fut. Ezt a
rendszer indítja el bekapcsoláskor és nem lövi ki a háttérben, ezért nincs
szükség sem boot-vevőre, sem előtérszolgáltatásra — és a gyereknek semmit nem
kell elindítania.

1. `GuardService` figyeli az ablakváltásokat. Csak azt kéri, melyik app jött
   előre; a képernyő tartalmát nem olvassa (`canRetrieveWindowContent="false"`).
2. Ha zárolt app jön előre és van keret, percenként vonja a `played` mezőt.
3. Nullánál `GLOBAL_ACTION_HOME` kiteszi az appot az előtérből, és a `BlockOverlay`
   panel megmondja, miért.
4. Ha a nap még nem indult el, nincs keret — tehát minden zárolt app zárva.

## Engedélyek

| Engedély | Mire kell |
|---|---|
| Kisegítő lehetőségek | Látni, melyik app van előtérben |
| Más appok fölé rajzolás | A „nincs több idő" panel |

**Hálózati engedély szándékosan nincs a manifestben.** Az app semmit nem küld
sehova, és a kikérdezéshez sem kell internet.

A főképernyő egy csíkban egyesével végigvezet ezen a három lépésen (figyelő,
panel, appok kiválasztása), és eltűnik, amikor kész.

## Csalás ellen

- A játékidő mérése `SystemClock.elapsedRealtime()` alapján megy, **nem a
  faliórán** — az óra átállítása nem ad plusz percet.
- A dátum visszaállítása új napot adna; ezt nem tudjuk megakadályozni, de a
  `noteClock` észreveszi a visszafelé ugrást, és bejegyzi a naplóba.
- A szolgáltatás ki- és bekapcsolása időbélyeggel a naplóba kerül. A szülői
  képernyőn látszik, mikor nem élt a védelem.

**Amit nem tud:** ha a gyerek kikapcsolja a kisegítő szolgáltatást a rendszer
beállításaiban, a zárolás megszűnik. Ezt megelőzni csak eszközgazda-jogosultsággal
(Device Owner) lehet, amihez gyári visszaállítás és `adb`-s kiépítés kell.
Kimutatni viszont ki tudjuk — a napló megőrzi.

## Fordítás

Android SDK kell hozzá (Android Studio). A repó gyökeréből:

```
cd android
./gradlew assembleDebug
```

Az APK: `app/build/outputs/apk/debug/app-debug.apk` — ezt kell a telefonra
másolni és megnyitni (ismeretlen forrás engedélyezése kell hozzá).

Vagy: Android Studio → *Open* → az `android` mappa → *Run*.

- `minSdk 29` (Android 10), `targetSdk 35`
- Kotlin 2.0, AGP 8.7

## Fájlok

| Fájl | Mi |
|---|---|
| `GuardService.kt` | A figyelő és a percszámlálás |
| `BlockOverlay.kt` | A zárolás panel |
| `Store.kt` | Közös tároló a WebView-val, napló, óraátállítás-figyelés |
| `KreditBridge.kt` | A `window.KreditNative` híd |
| `MainActivity.kt` | WebView + a beállítás végigvezetése |
| `ParentActivity.kt` | Appválasztó, védelmi állapot, napló — a webes PIN mögött |

## Ami itt nem készült el

A projekt **nincs lefordítva** — ahol írtam, ott nincs Android SDK. A
forráskód teljes és az erőforrás-hivatkozások ellenőrizve vannak, de az első
`assembleDebug` hozhat olyan hibát, amit csak fordító talál meg.
