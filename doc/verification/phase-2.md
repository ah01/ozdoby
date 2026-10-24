# Fáze 2 — Mantine editor a 3D náhled

Datum: 24. 10. 2026. Předchozí základ je v commitu `42ed391`. Geometrický formát a generátor zůstávají verze 0.1.0, schemaVersion 1.

## Rozsah a UI knihovna

Na přímé přání uživatele je rozhraní postavené na **Mantine 9.7.3** (`@mantine/core` + stejná verze `@mantine/hooks`). Používá standardní `MantineProvider`, společné téma, `NumberInput`, `Slider`, `SegmentedControl`, `Accordion`, `Paper`, `Button`, `Alert` a `Modal`. Vlastní CSS řeší především rozložení editoru a náhledu. Číselné vstupy nemají automatické ořezávání do rozsahu; neplatné rozepsané hodnoty zůstávají ve formuláři.

Tato verze Mantine požaduje React `^19.2.0`, tedy podporuje instalovaný 19.3.1. R3F 9.8.2 má peer rozsah React `>=19 <19.4`; drei 10.7.9 podporuje R3F 9 a React 19. Three.js je 0.186.1, typy 0.186.0. Vše je připnuté v npm lockfile, bez obcházení peer dependencies. Vite integrace vychází z [oficiálního postupu Mantine](https://mantine.dev/guides/vite/). Nepoužíváme vlastní PostCSS rozšíření, takže stačí distribuované CSS knihovny a běžné CSS aplikace.

Jeden sdílený Zod kontrakt nadále rozhoduje o platnosti parametrů. Stav reduceru rozlišuje rozepsané hodnoty, poslední validní model a jeho revizi. Kombinační chyby lze opravit i změnou jiného pole; opraví se celý aktuální koncept formuláře. Výběr presetu či reset obnoví jeho profil a povrch. Místní úložiště obsahuje pouze validní nastavení a tiskové předpoklady, s prodlevou 400 ms.

## Náhled a výpočty

Náhled používá R3F a drei, Z-up kameru, orbit/pan/zoom, podložku v Z = 0, osy, kótu výšky a odlišený krček. Tiskový a zavěšený pohled jsou výhradně zobrazovací transformace. Kamera při běžných změnách nepřerámovává; při prvním zobrazení a explicitním resetu zohlední výšku, šířku i poměr stran okna.

Worker po 100ms debounce připraví kanonickou síť, validaci i oddělenou neindexovanou renderovací kopii. Její plášť má vyhlazené normály, koncové disky ploché normály a krček vlastní barvu. UI neprovádí výpočty normál ani přestavbu parametrického povrchu. Zastaralý worker je ukončen. Předchozí model během přepočtu zůstává viditelný a označený; při chybě se netváří jako aktuální výsledek.

Geometrie každé revize je deklarativní R3F objekt s uvolněním starých GPU bufferů. Materiály i Canvas zůstávají mezi revizemi připojené. Nedostupný nebo ztracený WebGL kontext zachytí fallback/error boundary, aniž by odpojil editor a exportní worker.

Export používá vlastní worker a zamrazené parametry s revizí. Název STL využívá skutečnou exportní šířku bbox. Novější editace nemění probíhající export. Výslovné upozornění vedle exportu říká, že úplná tisková analýza zatím není implementovaná.

## Ověření

Windows, Node 26.12.1, npm 11.20.0, Google Chrome **153.0.8010.55**. Playwright 1.64.1 spouští oddělený profil Chrome s ANGLE SwiftShaderem. Automatické testy nepoužívají osobní profil prohlížeče.

- 32 jednotkových testů: předchozí geometrické testy a nové testy rozepsaných hodnot, souvisejících chyb, revizí, presetů/resetu, ochrany spodních vrstev včetně obnovy presetu s uloženým tiskovým předpokladem, místního úložiště a oddělené renderovací kopie.
- Prohlížečové scénáře: zachování prázdného pole, blokace exportu při chybě, klávesnice slideru, ukládání/reload, zamrazená exportní revize, bitově stejné STL při přepnutí pohledu, export JSON, chybějící WebGL i blokované úložiště, 100 dokončených úprav, kamera/reset, mobilní šířka a klávesnice dialogu, rychlé úpravy a reset povrchu.
- Desetinná hodnota se skutečnými klávesovými událostmi `1.2` je správně prezentována česky jako `1,2 mm`; `valueIsNumericString` chrání normalizované hodnoty při kombinaci lokalizace a jednotek. Slider používá přístupný `thumbLabel`.
- Změna zavěšeného pohledu nemění žádný byte finálního STL. Export spuštěný před změnou výšky zůstává na původních rozměrech a nese správný název.
- Při vynuceně nedostupném WebGL a blokovaném localStorage bylo možné upravit výšku na 100 mm a stáhnout validní uzavřený STL o celkové výšce 108 mm.

Kontrolní snímek: `phase-2-editor.jpg` (1440px desktop, protáhlý profil, tělo 96 mm, amplituda 1,2 mm, twist 90°). Výsledky průběžných oprav nejsou zaměňované za fyzické ověření; tisk neproběhl.

## Přijímací kritéria a omezení

- [x] Validní změny dostanou novou revizi; prázdné, neúplné a nevalidní hodnoty zůstávají v konceptu formuláře.
- [x] Žebrování, amplituda, twist a chráněný krček jsou podloženy geometrickými testy; při nulové amplitudě se twist geometricky neprojevuje.
- [x] Tiskový/zavěšený pohled a reset kamery fungují, export zůstává neck-first.
- [x] Po 100 dokončených změnách se nehromadí živé geometrie ani materiály; kamera zachovává polohu i target.
- [x] Číselné vstupy, slidery, preset, export, reset i nápověda jsou ovladatelné klávesnicí.
- [x] Validní nastavení se obnoví po reloadu; chyby úložiště a WebGL jsou explicitní a neblokují generování STL.
- [ ] Kompletní tisková analýza, mapa rizik, import JSON v UI, zbytek slicerové matice a fyzické ověření patří do dalších fází.

Výkonnostní p95 rozpočty ještě nejsou přijaté ani naměřené na referenčním hardwaru. Test 100 úprav je kontrolou správnosti a životního cyklu prostředků, nikoli měřením výrobního výkonu. Three.js náhled se načítá samostatným chunkem, přibližně 933 kB / 248 kB gzip; Vite upozornění na jeho velikost zůstává viditelné. Mantine `use client` značky v tomto čistě klientském SPA nemají serverovou hranici; build filtruje pouze tento konkrétní typ hlášení z Mantine modulů. Zůstává také upozornění z R3F na deprecated `Three.Clock`; běžný průchod během 100 úprav nevykázal chyby konzole. Chybová hlášení při záměrném odpojení WebGL patří k samostatnému fallback testu.

Vizuální slicerová brána fáze 0 a fyzický tisk zůstávají otevřené stejně jako před touto změnou. Fáze 2 sama o sobě nedokončuje MVP.
