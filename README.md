# Baňka studio

Lokální generátor parametrických vánočních ozdob pro spiral vase tisk. React + strict TypeScript + Vite, Mantine pro rozhraní a React Three Fiber/drei pro Three.js náhled. Geometrie, validace a STL encoder jsou čisté TypeScript moduly. Výpočty i příprava renderovacích dat běží v module Web Workeru.

Implementované jsou technické výstupy fáze 0 a fáze 1–3: tři presety, rozměry, krček, žebra, twist, 3D náhled, ukládání, solid STL/JSON a geometrická tisková analýza s mapou rizik. Editor vyplňuje celé okno, levé nastavení má vlastní posuvník, rozměry/hodnocení/export zůstávají dole a podrobné výsledky jsou v popoveru. Na malé obrazovce se nastavení otevírá zleva jako vysouvací panel. Kompletní slicerová matice, import JSON v UI a objímka přijdou v dalších fázích; MVP ani fyzický výtisk zatím nejsou ověřeny. Podrobnosti a otevřené brány: [stav implementace](doc/IMPLEMENTATION_STATUS.md).

Vedle stažení je volba **Detail**: hrubší STL (odchylka do 0,15 mm), standardní (výchozích 0,05 mm) a jemné (0,02 mm). Hrubší síť usnadňuje export složitých žeber a zmenšuje soubor; náhled se při změně detailu nepřepočítává. Export dovoluje až 2 miliony trojúhelníků (přibližně 100 MB), náhled 600 tisíc. Přesnost se nikdy nesnižuje automaticky. Volba detailu platí pro příští export a po obnovení stránky se vrací na standard. Kapacitní měření a omezení: [detail STL](doc/verification/stl-detail.md).

## Spuštění

Node.js `^22.12.0 || ^24.0.0 || >=26.0.0`, npm a moderní desktopový prohlížeč. Ověřeno s Node 26.12.1 a npm 11.20.0 na Windows.

```powershell
npm ci --ignore-scripts
npm run dev
```

Otevřete `http://127.0.0.1:5173`. Pokud je port obsazený, Vite vypíše jiný port. Instalace se obejde bez instalačních skriptů balíčků; esbuild používá nativní volitelný balíček z lockfile. Runtime aplikace nepoužívá CDN, externí fonty ani backend.

## Kontroly a referenční soubory

```powershell
npm run typecheck
npm test
npm run build
npm run fixtures
# Všechny kontroly výše:
npm run check
# Průchozí scénáře a 100 dokončených změn náhledu:
npm run test:e2e
# Referenční souhrny analýzy (S01, S02, žebra/twist, různé vrstvy):
npx --no-install tsx scripts/analyse-fixtures.ts
# Kapacitní průchod exportu až k 2 milionům trojúhelníků:
node --expose-gc --import tsx scripts/verify-stl-detail.ts
```

Před novým `npm ci` zastavte běžící Vite; Windows jinak nemůže vyměnit otevřenou nativní knihovnu Rolldown. Některé sandboxy Windows omezují `realpath` workeru; produkční sestavení bylo ověřeno mimo takový sandbox.

Prohlížečové testy používají samostatný dočasný profil již nainstalovaného Google Chrome a software WebGL pro opakovatelnost. Osobního profilu ani dat prohlížeče se nedotýkají. Spustí Vite, pokud na portu 5173 ještě neběží. Výstupy a případné trace soubory jsou v ignorovaném `test-results/`. Testy mají také vývojový snímek počtu živých renderovacích prostředků; tato diagnostika není součástí produkčního buildu.

`npm run fixtures` deterministicky vytvoří dva STL, JSON nastavení a manifest s SHA-256, rozměry, topologií a výsledkem nezávislého STL načtení v `doc/verification/fixtures/`.

```powershell
# S nainstalovaným PrusaSlicerem; cesta může být zadána parametrem -Slicer:
.\scripts\verify-slicer.ps1
# Nezávislé načtení libovolného našeho binárního STL:
npx --no-install tsx scripts/validate-stl.ts cesta/model.stl
```

Slicerový skript vytvoří lokální diagnostické G-code a rozvinutou konfiguraci v ignorovaném `doc/verification/.scratch/`, uloží logy a zkontroluje spirálové dráhy. Používá obecný testovací profil, který není určen k přímému spuštění na konkrétní tiskárně. Postup vizuální kontroly a skutečné výsledky jsou v [záznamu fáze 0](doc/verification/phase-0.md).

## Struktura

- `src/domain/`: Zod schémata, meze, presety a tiskové předpoklady.
- `src/geometry/`: analytický profil, povrch, adaptivní triangulace a topologická validace.
- `src/io/`: float32 binární STL a verzovaný JSON.
- `src/workers/`: revize, request ID, hash, strukturované chyby a vlastnictví bufferů.
- `src/app/`: reducer s revizemi, ukládání, worker hook, složení editoru a jednotné téma Mantine.
- `src/features/editor/`: Mantine číselné vstupy/slidery a popis editovatelných polí. Zod v doméně zůstává společným kontraktem.
- `src/features/preview/`: samostatně načítaný Three.js náhled a čistá příprava renderovací kopie pro worker.
- `src/features/export/`: export zamrazené revize a stahování souborů.
- `src/analysis/`: normálové převisy, obousměrné vzdálenosti obrysů, zjemnění a strukturovaný report.
- `src/features/printability/`: tiskové vstupy, přehled rizik, podrobnosti a legenda.
- `tests/`: geometrie, 50 deterministických kombinací, poškozené sítě, průniky, STL round-trip, worker protokol, stav editoru a Playwright scénáře.
- `scripts/`: reprodukovatelné referenční výstupy a kontrola sliceru.

Geometrie je v mm, osa Z směřuje vzhůru a krček začíná na Z = 0. STL je uzavřený solid bez vnitřní stěny. Tiskové vstupy mají vlastní revizi a analytický worker: jejich změna nepřegeneruje tělo ani nezmění STL bajty. Uzavřený STL neznamená uzavřený konec vase výtisku. Odhad tisknutelnosti ani ověřená dráha nenahrazují skutečný výtisk.
