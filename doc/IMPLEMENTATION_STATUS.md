# Stav implementace

Aktualizováno 24. 10. 2026. Generátor 0.1.0, analýza 1.0.0. Základ fáze 0–1 je v commitu `42ed391`, Mantine editor ve `3209ca8` a tisková analýza v `d61e788`. Na přání uživatele editor nově vyplňuje celé okno, s levým posuvným nastavením a spodním souhrnem/exportem; detaily analýzy se otevírají v popoveru.

## Přehled fází

| Fáze | Implementováno | Automaticky ověřeno | Ověřeno ve sliceru | Ověřeno výtiskem |
| --- | --- | --- | --- | --- |
| 0 — geometrie → STL → slicing | Ano | Ano | CLI + rozbor G-code; GUI a snímky čekají | Ne |
| 1 — projekt a kanonická geometrie | Ano | Ano | Tři presety testované geometricky; S01/S02 v CLI | Ne |
| 2 — editor a Three.js náhled | Ano; Mantine, formuláře, povrch, 3D, kamera a ukládání | Ano; reducer, render copy, 6 Playwright scénářů včetně 100 úprav | — | Ne |
| 3 — tisková analýza a mapa rizik | Ano; normály, obousměrné obrysy, zakončení, report a barvy | Analytické fixtures a 3 nové Playwright scénáře | Nenahrazuje slicing | Ne |
| 4 — dokončení exportního průchodu a MVP | Částečný společný exportní základ | STL/JSON základ ano; úplné E2E a matice ne | S01/S02, nikoli celá matice | Ne |
| 5 — samostatná objímka | Ne | Ne | Ne | Ne |
| 6 — fyzické ověření sady | Ne | Ne | — | Ne |

**MVP není dokončené. Brána fáze 0 zůstává otevřená pro vizuální záznam sliceru.** Jeho CLI slicing neukázal selhání základního neck-first konceptu, proto pokračovala nezávislá implementace fáze 1–2. Žádná fáze není označena jako fyzicky ověřená.

## Provedené změny

- React 19.3.1, TypeScript 7.0.2 (`strict` a `noUncheckedIndexedAccess`), Vite 8.3.5, Vitest 5.0.5, Zod 4.6.7, tsx 4.23.15. Připnuté přímé závislosti a npm lockfile. Engine sjednocen s Vitest: Node `^22.12.0 || ^24.0.0 || >=26.0.0`.
- Nezávislá doména bez Reactu, DOM a WebGL: schémata, kombinované meze, tiskové vstupy, tři presety, profil, sinusový povrch, ochrana krčku, adaptivní triangulace a uzávěry.
- Kanonická indexovaná topologie, validátor, omezení zdrojů se strukturovanou chybou a matematická mez interpolace v celé buňce. Odůvodnění a numerické tolerance jsou v `geometry.md`.
- Validovaný float32 binární STL encoder, verzovaný JSON a kanonický hash vstupů. Nezávislé načtení STL pro round-trip a kontrolu stažených souborů.
- Worker protokol s request ID, revizí, druhem úlohy, hashem a strukturovanými chybami; předávání vlastnictví nových bufferů. Ukončení workeru ruší zastaralou práci; export používá samostatný worker a zamrazené parametry.
- Mantine 9.7.3 pro společné téma, číselné vstupy, slidery, panely, upozornění, tlačítka a nápovědu. Platnost parametrů dál rozhoduje společné doménové Zod schéma. Nevalidní koncept formuláře se nepropíše do geometrie ani úložiště.
- Three.js 0.186.1 přes R3F 9.8.2 a drei 10.7.9: Z-up náhled, orbit/pan/zoom, podložka, osy, rozměrová kóta, odlišený krček, tiskový/zavěšený pohled a explicitní reset. Změna parametrů zachovává kameru.
- Worker připravuje také renderovací kopii s normálami a barvami, předchozí náhled je při přepočtu označen. Deklarativní R3F geometrie se uvolňují. Nedostupné WebGL ani úložiště neblokují parametry a STL. Aplikace nepoužívá externí fonty, CDN ani backend.
- Generátor S01/S02 STL a JSON, manifest s hashi, dva slicerové logy a info výpisy, diagnostický profil, opakovatelný PowerShell průchod a rozbor G-code. Detaily jsou v `verification/phase-0.md`.

## Spuštěné kontroly a skutečné výsledky

Prostředí: Windows, Node **26.12.1**, npm **11.20.0**, PrusaSlicer **2.9.6**, Google Chrome **153.0.8010.55**. Přesné peer závislosti byly ověřeny z metadat npm: Mantine 9.7.3 i R3F 9.8.2 podporují instalovaný React 19.3.1. Bez experimentálního R3F 10 a bez vynucování nekompatibilních peer závislostí. Detaily a odkazy na oficiální dokumentaci: `verification/phase-2.md`.

| Kontrola | Výsledek |
| --- | --- |
| `npm ci --ignore-scripts --no-audit` | Prošlo, čistá instalace z lockfile. Běžící Vite bylo nutné zastavit kvůli zámku nativní knihovny ve Windows. |
| `npm run typecheck` | Prošlo. |
| `npm test` | 42 testů v 5 souborech prošlo; navíc analytické kužely, segmentové BVH, mezivrstvy a export s nedokončenou analýzou. |
| `npm run build` | Prošlo včetně produkčního worker chunku. Windows sandbox při prvním pokusu blokoval `realpath`; kontrola mimo sandbox prošla. |
| `npm run fixtures` | Dva validní solid STL/JSON a manifest, nezávislý STL round-trip. |
| `scripts/verify-slicer.ps1` | Prošlo načtení i slicing obou fixture a diagnostická kritéria G-code. |
| `npm run test:e2e` | 11 scénářů: původní editor, aktuálnost analýzy, bitově stejné STL při změně extruze, selhání analytického workeru, samostatný posuvník a pevná spodní lišta, popover a mobilní vysouvací nastavení. |
| Životní cyklus náhledu | Po 100 dokončených změnách zůstává 5 geometrií, 5 materiálů, 5 programů; stejná kamera i target, bez chyb konzole. Aktuální záznam: `verification/workspace-resources.json`; původní fáze 2 je zachovaná. |
| Snímky aplikace | Historické fáze 1–2 zůstávají uložené. Aktuální UI: `verification/workspace-fullscreen.jpg` a `verification/workspace-analysis-popover.jpg`. |

Testy pokrývají tři presety, meze, referenční válec (objem, jednotky, orientaci), determinismus, nezměněný krček, nulovou amplitudu, směr twistu, chyby topologie, neplatná čísla/JSON, odmítnutí extrémní deformační obálky nebo limitu zdrojů, STL round-trip, opožděné odpovědi a nezávislé průniky neincidentních trojúhelníků s pozitivními i negativními kontrolami. Vzorky vnitřků/hran trojúhelníků zkroucené žebrované sítě nepřekračují deklarovanou analytickou mez.

## Výsledek experimentální brány

S01: 56 × 56 × 96 mm, 39 936 ploch, rameno 35,60° od svislice. PrusaSlicer hlásí nízkou adhezi. S02: 90 × 90 × 43 mm, 41 984 ploch, rameno 72,93°; slicer hlásí navíc kolabující převis a volné extruze. U obou je dno do Z = 0,60 mm a nad ním jediný spirálový obvod. Na konci je plochý extruzní doběh po otevřeném obvodu; odhad otvoru přibližně 1,50 / 1,53 mm podle dráhy, nikoli měření výtisku. Výchozí profil zatím nebyl změněn.

## Závislosti a nejbližší pokračování

1. Doložit vizuální kontrolu S01/S02 ve sliceru a snímky. CLI je dostupné, ale spuštěný G-code viewer neposkytl automatizaci cílovatelné okno. Generované soubory a přesný checklist jsou připravené. Nejde o důvod blokovat nezávislou práci na editoru.
2. Fáze 3 je implementovaná; podrobnosti, metriky a omezení jsou v `verification/phase-3.md`. Fullscreen rozložení je implementované. Stránka sama nemá posuvník; nastavení vlevo a podrobný popover se posouvají samostatně. Spodní lišta je vždy viditelná.
3. Fáze 4: import JSON v UI, rozšíření Playwright scénářů o report a importní chyby, zbytek slicerové matice, výkonnostní p95 rozpočty. Výkon zatím není přijat jako ověřený; velký Three.js chunk je načítaný samostatně a jeho velikost zůstává zdokumentovaná.
4. Fyzická tiskárna, skutečný profil, materiál a mechanické měření budou potřeba pro fázi 6. Zatím nebyly vyžadovány k nezávislé implementaci.
