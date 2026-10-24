# Baňka studio

Lokální generátor parametrických vánočních ozdob pro spiral vase tisk. React + strict TypeScript + Vite; geometrie, validace a STL encoder jsou čisté TypeScript moduly. Výpočty aplikace běží v module Web Workeru.

Aktuálně jsou implementovány technické výstupy fáze 0 a základ fáze 1. Stránka umí vybrat tři referenční presety a stáhnout solid STL nebo verzovaný JSON. Interaktivní 3D editor, formulář rozměrů, úplná tisková analýza a objímka přijdou v dalších fázích. Podrobnosti a otevřené brány: [stav implementace](doc/IMPLEMENTATION_STATUS.md).

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
```

Před novým `npm ci` zastavte běžící Vite; Windows jinak nemůže vyměnit otevřenou nativní knihovnu Rolldown. Některé sandboxy Windows omezují `realpath` workeru; produkční sestavení bylo ověřeno mimo takový sandbox.

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
- `src/app/`: minimální české rozhraní pro ověření generátoru.
- `tests/`: geometrie, 50 deterministických kombinací, poškozené sítě, průniky, STL round-trip a worker protokol.
- `scripts/`: reprodukovatelné referenční výstupy a kontrola sliceru.

Geometrie je v mm, osa Z směřuje vzhůru a krček začíná na Z = 0. STL je uzavřený solid bez vnitřní stěny. Uzavřený STL neznamená uzavřený konec vase výtisku. Odhad tisknutelnosti ani ověřená dráha nenahrazují skutečný výtisk.
