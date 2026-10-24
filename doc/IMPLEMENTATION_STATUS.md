# Stav implementace

Aktualizováno 24. 10. 2026. Generátor 0.1.0. Výchozí stav byl prázdný Git repozitář bez commitů, obsahující pouze `doc/IMPLEMENTATION_PLAN.md`; žádné další projektové instrukce ani zavedený správce balíčků nebyly nalezeny. Původní plán je zachován.

## Přehled fází

| Fáze | Implementováno | Automaticky ověřeno | Ověřeno ve sliceru | Ověřeno výtiskem |
| --- | --- | --- | --- | --- |
| 0 — geometrie → STL → slicing | Ano | Ano | CLI + rozbor G-code; GUI a snímky čekají | Ne |
| 1 — projekt a kanonická geometrie | Ano | Ano | Tři presety testované geometricky; S01/S02 v CLI | Ne |
| 2 — úplný editor a Three.js náhled | Ne; jen minimální referenční stránka a povrchový základ | Jen worker průchod a export referenčních presetů | — | Ne |
| 3 — tisková analýza a mapa rizik | Ne; pouze analytický hladký odhad pro fázi 0 | Dílčí rozlišení S01/S02 | — | Ne |
| 4 — dokončení exportního průchodu a MVP | Částečný společný exportní základ | STL/JSON základ ano; úplné E2E a matice ne | S01/S02, nikoli celá matice | Ne |
| 5 — samostatná objímka | Ne | Ne | Ne | Ne |
| 6 — fyzické ověření sady | Ne | Ne | — | Ne |

**MVP není dokončené. Brána fáze 0 zůstává otevřená pro vizuální záznam sliceru.** Jeho CLI slicing neukázal selhání základního neck-first konceptu, proto bylo podle plánu dokončeno nezávislé geometrické jádro fáze 1. Žádná fáze není označena jako fyzicky ověřená.

## Provedené změny

- React 19.3.1, TypeScript 7.0.2 (`strict` a `noUncheckedIndexedAccess`), Vite 8.3.5, Vitest 5.0.5, Zod 4.6.7, tsx 4.23.15. Připnuté přímé závislosti a npm lockfile. Engine sjednocen s Vitest: Node `^22.12.0 || ^24.0.0 || >=26.0.0`.
- Nezávislá doména bez Reactu, DOM a WebGL: schémata, kombinované meze, tiskové vstupy, tři presety, profil, sinusový povrch, ochrana krčku, adaptivní triangulace a uzávěry.
- Kanonická indexovaná topologie, validátor, omezení zdrojů se strukturovanou chybou a matematická mez interpolace v celé buňce. Odůvodnění a numerické tolerance jsou v `geometry.md`.
- Validovaný float32 binární STL encoder, verzovaný JSON a kanonický hash vstupů. Nezávislé načtení STL pro round-trip a kontrolu stažených souborů.
- Worker protokol s request ID, revizí, druhem úlohy, hashem a strukturovanými chybami; předávání vlastnictví nových bufferů. Ukončení workeru ruší zastaralou práci; export používá samostatný worker a zamrazené parametry.
- Minimální česká stránka pro přepínání presetů, přehled rozměrů a stažení STL/JSON. Neobsahuje dosud 3D náhled ani formulář; nevydává topologickou validitu za hodnocení tisknutelnosti. Nepoužívá externí fonty, CDN ani backend.
- Generátor S01/S02 STL a JSON, manifest s hashi, dva slicerové logy a info výpisy, diagnostický profil, opakovatelný PowerShell průchod a rozbor G-code. Detaily jsou v `verification/phase-0.md`.

## Spuštěné kontroly a skutečné výsledky

Prostředí: Windows, Node **26.12.1**, npm **11.20.0**, PrusaSlicer **2.9.6**. Verze balíčků byly ověřeny z metadat npm; byl zvolen stabilní základ bez experimentálního R3F 10. R3F 9 / React 19 podle [oficiální kompatibility](https://r3f.docs.pmnd.rs/getting-started/introduction) bude doplněn ve fázi 2; Three.js balíčky zatím nejsou nainstalované.

| Kontrola | Výsledek |
| --- | --- |
| `npm ci --ignore-scripts --no-audit` | Prošlo, čistá instalace z lockfile. Běžící Vite bylo nutné zastavit kvůli zámku nativní knihovny ve Windows. |
| `npm run typecheck` | Prošlo. |
| `npm test` | 25 testů ve 3 souborech prošlo; součástí je 50 deterministických kombinací parametrů. |
| `npm run build` | Prošlo včetně produkčního worker chunku. Windows sandbox při prvním pokusu blokoval `realpath`; kontrola mimo sandbox prošla. |
| `npm run fixtures` | Dva validní solid STL/JSON a manifest, nezávislý STL round-trip. |
| `scripts/verify-slicer.ps1` | Prošlo načtení i slicing obou fixture a diagnostická kritéria G-code. |
| Průchod v prohlížeči | Načtení stránky → worker ready → přepnutí na Kapku → skutečné stažení STL; nezávisle znovu načten, 1 uzavřená komponenta, bbox 56 × 56 × 92 mm. Stažení JSON pro výchozí preset rovněž proběhlo. |
| Snímek aplikace | `verification/phase-1-app.jpg`. |

Testy pokrývají tři presety, meze, referenční válec (objem, jednotky, orientaci), determinismus, nezměněný krček, nulovou amplitudu, směr twistu, chyby topologie, neplatná čísla/JSON, odmítnutí extrémní deformační obálky nebo limitu zdrojů, STL round-trip, opožděné odpovědi a nezávislé průniky neincidentních trojúhelníků s pozitivními i negativními kontrolami. Vzorky vnitřků/hran trojúhelníků zkroucené žebrované sítě nepřekračují deklarovanou analytickou mez.

## Výsledek experimentální brány

S01: 56 × 56 × 96 mm, 39 936 ploch, rameno 35,60° od svislice. PrusaSlicer hlásí nízkou adhezi. S02: 90 × 90 × 43 mm, 41 984 ploch, rameno 72,93°; slicer hlásí navíc kolabující převis a volné extruze. U obou je dno do Z = 0,60 mm a nad ním jediný spirálový obvod. Na konci je plochý extruzní doběh po otevřeném obvodu; odhad otvoru přibližně 1,50 / 1,53 mm podle dráhy, nikoli měření výtisku. Výchozí profil zatím nebyl změněn.

## Závislosti a nejbližší pokračování

1. Doložit vizuální kontrolu S01/S02 ve sliceru a snímky. CLI je dostupné, ale spuštěný G-code viewer neposkytl automatizaci cílovatelné okno. Generované soubory a přesný checklist jsou připravené. Nejde o důvod blokovat nezávislou práci na editoru.
2. Fáze 2: přidat kompatibilní Three.js/R3F/drei, Z-up náhled a ovládání kamery, formulář s rozepsanými neplatnými hodnotami, revize, ukládání a kontrolu uvolňování prostředků.
3. Fáze 3: úplná normálová a obousměrná analýza úseček sousedních průřezů, stav reportu, mapa rizik a testy kuželů. Současný export je výslovně bez dokončené tiskové analýzy.
4. Fáze 4: import JSON v UI, automatizované Playwright scénáře, zbytek slicerové matice, výkonnostní p95 rozpočty. Výkon zatím není přijat jako ověřený.
5. Fyzická tiskárna, skutečný profil, materiál a mechanické měření budou potřeba pro fázi 6. Zatím nebyly vyžadovány k nezávislé implementaci.
