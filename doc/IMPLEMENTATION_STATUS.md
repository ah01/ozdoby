# Stav implementace

Aktualizováno 24. 10. 2026. Generátor 0.1.0, analýza 1.4.0. Základ fáze 0–1 je v commitu `42ed391`, Mantine editor ve `3209ca8`, tisková analýza v `d61e788`, vyšší kapacita/detail STL v `cb19fda` a nové tvary/průběhy v `ffbb71e`. Editor vyplňuje celé okno, s levým posuvným nastavením a spodním souhrnem/exportem; detaily analýzy se otevírají v popoveru. Mapa má přepínač přímo nad modelem, krček dovoluje 5–24 mm, poloměr zakončení 0–3 mm a složité kombinace využívají lokální plánování sítě a analýzy.

## Přehled fází

| Fáze | Implementováno | Automaticky ověřeno | Ověřeno ve sliceru | Ověřeno výtiskem |
| --- | --- | --- | --- | --- |
| 0 — geometrie → STL → slicing | Ano | Ano | CLI + rozbor G-code; GUI a snímky čekají | Ne |
| 1 — projekt a kanonická geometrie | Ano | Pět presetů a kombinace nových transformací | S01/S02 v CLI, nové tvary geometricky | Ne |
| 2 — editor a Three.js náhled | Ano; Mantine, formuláře, povrch, 3D, kamera a ukládání | Ano; reducer, render copy, 6 Playwright scénářů včetně 100 úprav | — | Ne |
| 3 — tisková analýza a mapa rizik | Ano; normály, obousměrné obrysy, zakončení, report a barvy | Analytické fixtures a 3 nové Playwright scénáře | Nenahrazuje slicing | Ne |
| 4 — dokončení exportního průchodu a MVP | Částečný společný exportní základ | STL/JSON základ ano; úplné E2E a matice ne | S01/S02, nikoli celá matice | Ne |
| 5 — samostatná objímka | Ne | Ne | Ne | Ne |
| 6 — fyzické ověření sady | Ne | Ne | — | Ne |

**MVP není dokončené. Brána fáze 0 zůstává otevřená pro vizuální záznam sliceru.** Jeho CLI slicing neukázal selhání základního neck-first konceptu, proto pokračovala nezávislá implementace fáze 1–2. Žádná fáze není označena jako fyzicky ověřená.

## Provedené změny

- React 19.3.1, TypeScript 7.0.2 (`strict` a `noUncheckedIndexedAccess`), Vite 8.3.5, Vitest 5.0.5, Zod 4.6.7, tsx 4.23.15. Připnuté přímé závislosti a npm lockfile. Engine sjednocen s Vitest: Node `^22.12.0 || ^24.0.0 || >=26.0.0`.
- Nezávislá doména bez Reactu, DOM a WebGL: schémata, kombinované meze, tiskové vstupy, pět presetů, profil, sinusový povrch, ochrana krčku, adaptivní triangulace a uzávěry.
- Vejce s kosinovým profilem a diamant s rovnějšími boky a hladkými přechody. Posun maxima 30–70 % výšky od krčku; obálka žeber celá/střed/krček a twist plynulý/rovnoměrný/tam-zpět. Sdílené analytické meze pro síť a analýzu 1.1.0. Starý JSON doplňuje původní průběhy, nové volby přežijí reload a export. Ověření a snímky: `verification/shapes.md`.
- Další transformace: oblá/úzká/široká žebra, jejich samostatné pootočení 0–360° a vodorovné vlny s hloubkou do 2 mm, 1–12 periodami a posunem o část periody. Analýza 1.2.0 a triangulace sdílejí nové meze derivací a kritické výšky. UI má šest tematických sekcí, popisy, stavy zapnuto/vypnuto, automatické otevření chyb a samostatné resety. Rozpracované výběry se neztrácejí při neplatném číselném vstupu. Ověření: `verification/transforms.md`.
- Krček od 5 mm ve schématu i editoru. Přepínač mapy rizik přesunut přímo do hlavního náhledu včetně mobilu, stav čekání/nedostupnosti bez starých barev. Náhled do 1,2 milionu ploch; lokální intervalové meze a vyvážení úhlového/výškového dělení zachovávají přesnost a zmenšují husté sítě. Analýza 1.3.0 používá lokální mezivrstvové vzorkování a 12 milionů porovnání. Zátěžový náhled 761 616 ploch a hrubší STL 1 018 240 ploch s dokončenou analýzou: `verification/geometry-limits.md`.
- Poloměr zakončení od nuly: skutečný sdílený vrchol místo nulového prstence/disku, stabilní kuželový přechod a certifikovaná kladnost ostatních průřezů. Ověřené jsou i 0,01mm a 0,1mm disky. Analýza 1.4.0 rozlišuje bodové STL od fyzického uzavření vase výtisku. Ověření: `verification/pointed-tip.md`.
- Kanonická indexovaná topologie, validátor, omezení zdrojů se strukturovanou chybou a matematická mez interpolace v celé buňce. Odůvodnění a numerické tolerance jsou v `geometry.md`.
- Validovaný float32 binární STL encoder, verzovaný JSON a kanonický hash vstupů. Nezávislé načtení STL pro round-trip a kontrolu stažených souborů.
- Volitelný detail STL 0,15 / 0,05 / 0,02 mm ve spodním panelu, exportní limit zvýšen z 300 000 na 2 miliony trojúhelníků (náhled 600 000). Paměťově úsporná topologická kontrola v typovaných polích. Detail je zamrazený v exportním požadavku, bez změny náhledu; přesnost se nikdy automaticky nesnižuje. Kapacitní průchod a jeho omezení: `verification/stl-detail.md`.
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
| `npm test` | 110 testů v 9 souborech prošlo; dosavadní geometrie, analýza a limity, navíc všech pět nulových špiček a malých disků, přesnost až k vrcholu s deformacemi, float32 round-trip a normály, bezpečné sloučení koncového prstence a bodová analýza. |
| `npm run build` | Prošlo včetně produkčního worker chunku. Windows sandbox při prvním pokusu blokoval `realpath`; kontrola mimo sandbox prošla. |
| `npm run fixtures` | Dva validní solid STL/JSON a manifest, nezávislý STL round-trip. |
| `scripts/verify-slicer.ps1` | Prošlo načtení i slicing obou fixture a diagnostická kritéria G-code. |
| `npm run test:e2e` | 18 scénářů prošlo: původní editor a transformace, aktuálnost analýzy, STL/JSON, 100 úprav náhledu, fullscreen/mobilní nastavení, detaily STL, samostatné resety a chyby, nově 5mm krček se skutečným STL, přímý přepínač mapy a hustá kombinace žeber/vln/twistu s dokončenou analýzou. |
| Cílená kontrola nulové špičky | 7 scénářů prošlo: dva nové desktop/mobil s reálným JSON/STL a reloadem, tři analytické regrese a dvě kontroly rozložení. Úplná sada 18 výše je předchozí záznam. |
| Životní cyklus náhledu | Po 100 dokončených změnách zůstává 5 geometrií, 5 materiálů, 5 programů; stejná kamera i target, bez chyb konzole. Aktuální záznam: `verification/workspace-resources.json`; původní fáze 2 je zachovaná. |
| Snímky aplikace | Aktuální mapa a zátěžový model: `verification/dense-risk-map.jpg` a `verification/risk-map-mobile.jpg`. Nastavení transformací: `verification/transform-sections.jpg`. Historické fáze 1–3 a předchozí rozšíření zůstávají uložené. |
| Špičaté zakončení | `verification/pointed-desktop.jpg` a `verification/pointed-mobile.jpg`, vytvořené v procházejících browserových scénářích. |

Testy pokrývají pět presetů, meze, referenční válec (objem, jednotky, orientaci), determinismus, nezměněný krček, nulovou amplitudu, směr twistu, chyby topologie, neplatná čísla/JSON, odmítnutí extrémní deformační obálky nebo limitu zdrojů, STL round-trip, opožděné odpovědi a nezávislé průniky neincidentních trojúhelníků s pozitivními i negativními kontrolami. Vzorky vnitřků/hran trojúhelníků zkroucené žebrované sítě nepřekračují deklarovanou analytickou mez, včetně všech 18 kombinací nových tvarů a průběhů.

## Výsledek experimentální brány

S01: 56 × 56 × 96 mm, 39 936 ploch, rameno 35,60° od svislice. PrusaSlicer hlásí nízkou adhezi. S02: 90 × 90 × 43 mm, 41 984 ploch, rameno 72,93°; slicer hlásí navíc kolabující převis a volné extruze. U obou je dno do Z = 0,60 mm a nad ním jediný spirálový obvod. Na konci je plochý extruzní doběh po otevřeném obvodu; odhad otvoru přibližně 1,50 / 1,53 mm podle dráhy, nikoli měření výtisku. Výchozí profil zatím nebyl změněn.

## Závislosti a nejbližší pokračování

1. Doložit vizuální kontrolu S01/S02 ve sliceru a snímky. CLI je dostupné, ale spuštěný G-code viewer neposkytl automatizaci cílovatelné okno. Generované soubory a přesný checklist jsou připravené. Nejde o důvod blokovat nezávislou práci na editoru.
2. Fáze 3 je implementovaná; podrobnosti, metriky a omezení jsou v `verification/phase-3.md`. Fullscreen rozložení je implementované. Stránka sama nemá posuvník; nastavení vlevo a podrobný popover se posouvají samostatně. Spodní lišta je vždy viditelná.
3. Fáze 4: import JSON v UI, rozšíření Playwright scénářů o report a importní chyby, zbytek slicerové matice, výkonnostní p95 rozpočty. Výkon zatím není přijat jako ověřený; velký Three.js chunk je načítaný samostatně a jeho velikost zůstává zdokumentovaná.
4. Fyzická tiskárna, skutečný profil, materiál a mechanické měření budou potřeba pro fázi 6. Zatím nebyly vyžadovány k nezávislé implementaci.
