# Parametrické vánoční ozdoby pro spiral vase mode

Implementační zadání pro Codex • React + TypeScript • verze 1.0 • 24. 10. 2026

## 1. Účel a výchozí rozhodnutí

Vytvoř webovou aplikaci, ve které uživatel zvolí základní tvar vánoční baňky, upraví jeho rozměry a povrchové transformace, prohlédne si 3D náhled a stáhne STL pro tisk v režimu spiral vase. Generování geometrie, analýza i export probíhají lokálně v prohlížeči. Aplikace nepotřebuje backend ani uživatelský účet.

Toto zadání navazuje na uživatelem potvrzený směr konverzace „Studie proveditelnosti aplikace“:

- Exportovat **uzavřené plné těleso**, nikoli předem vytvořenou tenkou dutou stěnu. Tloušťku a průběh tisku určuje slicer.
- Výchozí orientace je **neck-first**: malý válcový krček na podložce, nad ním tělo baňky. Po zavěšení se ozdoba otočí krčkem nahoru.
- Krček slouží jako rozhraní pro samostatnou objímku s uchycením háčku nebo provázku.
- Je potřeba Three.js náhled a kontrola převisů / rizik tisknutelnosti ještě před stažením.

Inspirací je [sada ozdob na Printables](https://www.printables.com/model/326837-christmas-tree-ornament-set-vase-mode-prints). Slouží k pochopení typu výrobku; toto zadání nepřebírá její síť ani rozměry. Stránku se při přípravě nepodařilo načíst, její technické detaily tedy nejsou ověřené.

**Původ rozhodnutí:** dostupný náhled předchozí konverzace obsahuje uživatelské požadavky, ale vlastní odpovědi asistenta jen jako odkazy. Nástroj pro načtení celé konverzace nebyl v této relaci dostupný. Konkrétní vzorce, rozměry, technologie nad rámec Reactu a postup objímky níže jsou proto nově navržené implementační výchozí hodnoty, nikoli tvrzení o dřívější dohodě.

### Zásadní rozdíl: STL a výtisk

Uzavřený STL povrch ohraničuje plný objem. Ve vase režimu z něj slicer vytvoří jednu obvodovou stěnu, bez výplně a horních plných vrstev; spodní plné vrstvy se nastavují zvlášť. Takové použití solid modelu odpovídá [dokumentaci PrusaSliceru](https://help.prusa3d.com/article/layers-and-perimeters_1748).

Z uzavřeného STL **neplyne uzavřená špička výtisku**. Na konci tisku může zůstat otvor nebo nekvalitní zakončení. Krček se také nestane plným válečkem v celé délce: nad spodními plnými vrstvami bude mít jednu stěnu. Návrh objímky a komunikace v UI s tím musí počítat.

## 2. Výsledný uživatelský průchod a rozsah

1. Uživatel otevře editor s hotovým výchozím modelem a náhledem v tiskové orientaci.
2. Vybere siluetu a nastaví rozměry, krček, žebrování a případné zkroucení.
3. Náhled se aktualizuje; rozměry a tisková orientace zůstávají čitelné.
4. Nastaví výšku vrstvy, šířku extruze a další vstupy orientační analýzy.
5. Zapne mapu rizik; u problémů uvidí místo, důvod a doporučenou úpravu.
6. Stáhne validní solid STL a podle potřeby JSON parametrů.
7. Importuje STL do sliceru a ověří skutečnou spiralizovanou dráhu podle checklistu.
8. V rozšířené verzi stáhne také samostatnou objímku pro běžný tisk.

### MVP: fáze 0–4

| Oblast | Součást MVP |
| --- | --- |
| Siluety | Zaoblená baňka, protáhlá baňka, kapka jako presety společné profilové funkce |
| Rozměry | Průměr základního těla, výška těla, průměr a délka krčku |
| Povrch | Jedno sinusové žebrování: počet, amplituda, celkové zkroucení |
| Rozhraní | Český editor, číselná pole a slidery, reset, přepnutí presetů |
| 3D | Three.js přes React Three Fiber, otáčení, zoom, podložka, osy, rozměry |
| Analýza | Validita geometrie, normálové převisy, změna obrysu mezi vrstvami, riziko špičky |
| Export | Binární solid STL v mm, export/import verzovaného JSON nastavení |
| Připojení objímky | Stabilní kruhový krček s chráněnou dosedací částí a popsanými rozměry |
| Výkon | Rychlý pracovní náhled, jemnější export, výpočty ve workeru |
| Verifikace | Automatické geometrické testy a zdokumentovaná kontrola v PrusaSliceru |

**MVP je hotové až po verifikaci sliceru ve fázi 4.** Samotná funkce „stáhnout STL“ nestačí. Generátor objímky je fáze 5; její fyzicky ověřené uchycení je fáze 6. Pokud se vydává aplikace jako kompletní sada baňka + objímka, musí splnit i tyto dvě fáze.

### Mimo MVP

Volný CAD editor, import cizích STL, textové reliéfy, booleany na těle baňky, otvory v těle, libovolné ohýbání osy, větvení a více oddělených obrysů v jedné výšce. Dále serverový slicing, generování G-code, automatické profily tiskáren, účty, galerie, platby, cloudové ukládání, PWA a výroba více baněk v jednom vase tiskovém jobu.

Alternativní orientace body-first, přímé očko v těle a mechanická západka objímky patří do pozdějšího experimentu. Jejich řešení nesmí zdržet průchozí neck-first variantu.

## 3. Pravidla implementace a rozhodovací brány

Při zahájení implementace nejprve přečti pravidla existujícího repozitáře a zjisti jeho stav. V prázdném repozitáři založ níže popsaný projekt; v existujícím zachovej zavedenou strukturu a správce balíčků, pokud vyhovují požadavkům.

Postupuj po fázích v uvedeném pořadí. Každá končí konkrétními výstupy a acceptance criteria. Výsledek zapiš do `doc/IMPLEMENTATION_STATUS.md`: provedené změny, spuštěné kontroly, jejich výsledek a zbývající závislosti. Stav rozlišuj jako „implementováno“, „automaticky ověřeno“, „ověřeno ve sliceru“ a „ověřeno výtiskem“.

Pokud chybí slicer nebo tiskárna, dokonči nezávislou implementaci a připrav přesné testovací soubory i checklist. Manuální ověření ponech jako neprovedené; fázi se závislým acceptance criterion neoznačuj za dokončenou. Fáze 0 je experimentální brána: když selže základní neck-first tvar, uprav nejprve profil, nikoli celý koncept aplikace.

Rutinní volby řeš v rámci tohoto zadání. Změnu solid exportu na dutou skořepinu, přidání backendu nebo změnu výchozí orientace předlož jako věcnou změnu rozsahu.

## 4. Technická architektura

### Doporučený stack

- React + TypeScript se zapnutým `strict`, Vite jako nástroj vývoje a sestavení statické aplikace.
- Three.js, `@react-three/fiber`, `@react-three/drei` pro náhled a ovládání kamery.
- Čisté TypeScript funkce pro parametrický model, triangulaci, validaci a analýzu.
- Zod nebo ekvivalent pro validaci vstupního JSON; jeden společný kontrakt pro UI i worker.
- React reducer/context pro aplikační stav. Další stavovou knihovnu přidej pouze při konkrétní potřebě.
- Vitest pro geometrii a Playwright pro několik průchozích scénářů editoru.
- Module Web Worker pro výpočetně náročné operace. Bez WASM/CAD kernelu v MVP.

Konkrétní stabilní verze vyber při založení projektu, ověř vzájemné peer dependencies a ulož lockfile. React a React Three Fiber mají kompatibilitu po hlavních verzích, viz [oficiální dokumentace R3F](https://r3f.docs.pmnd.rs/getting-started/introduction). Nepřebírej slepě příkaz instalující všechny balíčky v nejnovější verzi.

### Oddělení odpovědností

```text
Formulář / načtený JSON
        ↓ validace a normalizace parametrů
Neměnný parametrický model + revize
        ↓ worker
Profil → povrch → kanonická síť → validace / analýza
        ├─ pracovní síť → Three.js náhled
        ├─ zpráva a mapa rizik → UI
        └─ jemná validovaná síť → binární STL
```

Zdroj pravdy jsou parametry a jejich revize, nikoli modifikovaná Three.js scéna. Náhled a export používají stejnou profilovou a transformační funkci, pouze s jinou přesností triangulace. Analýza se vztahuje ke konkrétní revizi, tiskovým vstupům a verzi analytického algoritmu.

```text
src/
  app/                         složení editoru, stav, revize výpočtů
  features/editor/             formuláře, presety, validační zprávy
  features/preview/            scéna, kamera, podložka, legenda
  features/printability/       panel analýzy a doporučení
  features/export/             stažení STL a JSON
  domain/parameters.ts         schéma, limity, výchozí hodnoty
  domain/presets.ts
  geometry/profile.ts          základní radiální profil
  geometry/surface.ts          žebrování, zkroucení, ochranné obálky
  geometry/mesh.ts             triangulace a uzávěry
  geometry/validate.ts         topologie, objem, kvalita sítě
  analysis/overhang.ts
  analysis/layerSupport.ts
  analysis/report.ts
  io/stl.ts
  io/preset.ts
  workers/geometry.worker.ts
  workers/protocol.ts
tests/fixtures/                reprodukovatelné JSON a očekávané vlastnosti
tests/e2e/
doc/verification/              checklisty, záznamy a snímky ze sliceru
```

Jména souborů jsou návrh členění, nikoli důvod k přestavbě funkčního existujícího projektu. Doménová geometrie nesmí záviset na Reactu, DOM ani WebGL.

### Datové kontrakty

```ts
type ShapeId = "round" | "elongated" | "drop";

interface OrnamentParameters {
  schemaVersion: 1;
  shape: ShapeId;
  body: {
    baseDiameterMm: number;
    heightMm: number;
    maxRadiusAt: number;        // normalizovaná výška těla, 0 < p < 1
    tipRadiusMm: number;        // konečný poloměr zakončovacího disku
  };
  neck: { diameterMm: number; lengthMm: number };
  surface: {
    ribs: number;              // celé číslo
    amplitudeMm: number;
    twistDeg: number;          // celkové zkroucení od začátku do konce těla
    blendLengthMm: number;     // délka plynulého náběhu a doběhu deformace
  };
}

interface PrintAssumptions {
  nozzleDiameterMm: number;
  extrusionWidthMm: number;
  layerHeightMm: number;
  firstLayerHeightMm: number;
  bottomSolidLayers: number;
  maxOverhangFromVerticalDeg: number;
  minOverlapRatio: number;     // orientační podíl šířky extruze, 0 až 1
}

interface MeshData {
  positions: Float64Array;    // výpočet a validace; převod pro WebGL zvlášť
  indices: Uint32Array;
  faceRegions: Uint8Array;    // neck, body, baseCap, tipCap
}

type AnalysisState = "pending" | "ready" | "failed";
type RiskLevel = "low" | "warning" | "high";
```

Doplň serializovatelné zprávy s kódem, závažností, rozsahem Z, případně indexy ploch, naměřenou hodnotou a limitem. Geometrická validita a odhad tiskového rizika jsou dvě oddělené položky. Chyba topologie není jen červený převis.

Worker request a response nesou `requestId`, `revision`, druh úlohy a hash vstupů. Zastaralou odpověď UI zahodí. Přenos bufferu nesmí odpojit pole, které ještě používá náhled; vlastnictví polí řeš výslovně. Popis principu a přenosu dat je v [dokumentaci Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

## 5. Parametry a návrhové meze

Následující rozsahy vymezují vstupy podporované generátorem. Neznamenají, že každá jejich kombinace je vhodná k tisku. Kombinace vyhodnocuje geometrická validace a analýza.

| Parametr | Výchozí hodnota | Počáteční rozsah |
| --- | --- | --- |
| Silueta | Protáhlá | Zaoblená, protáhlá, kapka |
| Základní průměr těla | 56 mm | 30–100 mm |
| Výška těla bez krčku | 88 mm | 35–140 mm |
| Poloha maxima `maxRadiusAt` | 0,50 | 0,30–0,70; v MVP řízena presetem |
| Průměr krčku | 14 mm | 10–24 mm |
| Délka krčku | 8 mm | 5–16 mm |
| Poloměr zakončení | 1,2 mm | 0,8–3 mm; pokročilý parametr |
| Počet žeber | 12 | 3–24 |
| Amplituda | 0 mm | 0–4 mm, dále omezena lokálním poloměrem |
| Celkové zkroucení | 0° | −180° až +180° |
| Délka náběhu/deformace | 8 mm | 4–20 mm, nejvýše polovina výšky těla |

Výchozí tiskové předpoklady: tryska 0,4 mm, šířka extruze 0,45 mm, vrstva a první vrstva 0,20 mm, tři spodní plné vrstvy, limit převisu 45° od svislice, požadovaný orientační překryv 35 %. Jsou to **startovní vstupy analýzy**, nikoli ověřený výrobní profil pro všechny tiskárny a materiály.

Kombinační podmínky:

- `neckRadius < bodyRadius`, `tipRadius < bodyRadius` a všechny délky kladné.
- Radiální deformace musí zachovat `r > epsilon` ve všech podporovaných bodech a spojitý jednoduchý obrys. Extrémy amplitudy validuj i analyticky pomocí obálky, ne jen několika vzorky.
- Výška spodních plných vrstev `hFirst + (NBottom - 1) * h` musí zůstat uvnitř přímého krčku s rezervou alespoň jedné vrstvy. V MVP požaduj `NBottom >= 1`.
- Vztah výšky vrstvy, trysky a šířky extruze zobrazuj jako tiskové upozornění; neodvozuj univerzální tisknutelnost pouze z průměru trysky.
- Průměr v tabulce je průměr základního profilu před žebrováním. Vedle něho zobraz skutečný bounding box včetně deformace; exportu i objímce odpovídají skutečné rozměry.
- Vstupy `NaN`, `Infinity`, necelé počty, neznámá verze JSON a hodnoty mimo meze se odmítají s konkrétním důvodem. Formulář uchová rozepsaný text; nepropaguje neplatný stav do geometrie.

## 6. Geometrie těla a krčku

### Souřadnice a tisková orientace

Jednotka je milimetr. Osa Z je směr tisku. Podložka leží v `z = 0`, střed krčku v `x = y = 0`. Krček zabírá `0 <= z <= neckLength`; tělo pokračuje do `neckLength + bodyHeight`.

Náhled i STL používají stejnou tiskovou soustavu. Nastav kameru a ovládání pro Z-up, případně použij pouze zobrazovací převod celé scény. Případný režim „zavěšená ozdoba“ je orientace náhledu; nesmí potichu změnit export ani osu analýzy.

### Parametrická reprezentace

Použij soustavu vodorovných, vůči společnému středu hvězdicových průřezů:

```text
P(theta, z) = (r(theta, z) * cos(theta),
               r(theta, z) * sin(theta),
               z)
theta ∈ [0, 2π), r(theta, z) > 0
```

Tato omezená rodina usnadňuje zajištění jednoho jednoduchého obrysu v každé výšce. Zachování pozitivního poloměru, úhlového pořadí a společného středu je invariant všech MVP transformací. Nejde o obecný CAD model.

### Základní profil a presety

Pro první implementaci použij analytický profil ze dvou spojitých segmentů. Označ `u = (z - neckLength) / bodyHeight`, `p = maxRadiusAt`, `Rn = neckDiameter / 2`, `R = baseDiameter / 2`, `Rt = tipRadius`. Pro `S(t) = 3t² - 2t³`:

```text
krček:      r0(z) = Rn
0 ≤ u ≤ p:  r0(u) = Rn + (R - Rn) * S(u / p)
p < u ≤ 1:  r0(u) = R  + (Rt - R) * S((u - p) / (1 - p))
```

Vznikne hladké napojení na válec, maximum se svislou tečnou a malé kruhové zakončení. Tvar je stylizovaná baňka, nikoli přesná koule. Presety nastavují rozměry a polohu maxima; pracovní návrh: zaoblená 56 × 60 mm s `p = 0,5`, protáhlá 56 × 88 mm s `p = 0,5`, kapka 56 × 84 mm s `p = 0,65`. Ostatní výchozí rozměry zůstávají stejné.

Zaoblený preset smí mít horší analytické hodnocení než protáhlý. Aplikace jej nesmí automaticky označit za vhodný jen kvůli názvu. Přesnou kouli se seříznutím a napojením přidej případně jako další profil až po MVP; přechod z malého krčku do sféry je samostatný zdroj převisu.

### Žebrování a zkroucení

V MVP podporuj jeden společný předvídatelný předpis, nikoli libovolný zásobník modifierů:

```text
phi(u) = twistRadians * S(u)
r(theta, z) = r0(z) + A * E(u) * cos(k * (theta - phi(u)))
```

`A` je amplituda v mm, `k` celočíselný počet žeber. `E(u)` je součin hladkého náběhu a doběhu podle fyzické délky `blendLengthMm`; na krčku je nula a na konci těla se vrací k nule. Náběh i doběh mají nulovou první derivaci na chráněném rozhraní.

Výsledkem je zkroucení žeber při zachování vodorovných průřezů. Na rotačně symetrickém těle s `A = 0` nemá twist geometrický účinek; UI to vysvětlí. Geometrie krčku a jeho dosedací průměr zůstávají vůči těmto transformacím invariantní.

### Triangulace a přesnost

- Vytvářej indexovanou síť prstenců se sdílenými vrcholy a modulárním propojením posledního úhlu s prvním.
- Na obou koncích přidej rovinný disk a konzistentní orientaci ploch směrem ven. Vnitřní stěna se negeneruje.
- Pro konečný `tipRadius > 0` lze disky triangulovat vějířem. Podporu skutečného pólu s `r = 0` odlož; řada shodných vrcholů v pólu by vytvářela degenerace.
- Zachovej přesné výšky hranice krčku, maxima a konců obálek. Zjemňuj podle křivosti a požadované odchylky, ne jen podle pevného počtu řezů.
- Pracovní start: náhled 128 úhlů, export 256 úhlů, podle potřeby více. Pro `k` žeber použij nejméně 16 vzorků na jednu periodu. Počet segmentů musí současně splnit toleranci.
- Cílová maximální odchylka exportní sítě od parametrického povrchu je 0,05 mm. Ověřuj ji i uvnitř buněk/na hranách, nejen v generovaných vrcholech. Pokud limit prostředků brání splnění, export odmítni s důvodem.
- Startovní horní limit je 300 000 trojúhelníků pro tělo. Neomezuj výsledek tichým zhoršením přesnosti.
- Kanonická topologie používá společné vrcholy. Renderovací kopie může duplikovat vrcholy kvůli hranám, normálám nebo barvám ploch; její indexování není podkladem topologické kontroly.

### Geometrická validace

Před exportem ověř konečná čísla, rozsah indexů, nulové/zanedbatelné plochy, konzistentní orientaci, souvislost, uzavřenost a kladný podepsaný objem. Každá neorientovaná hrana musí mít právě dvě incidentní plochy, s opačným směrem hrany. Pro tělo baňky očekávej jednu komponentu a Eulerovu charakteristiku `V - E + F = 2`.

Samotný počet incidentních ploch ani Eulerova charakteristika nevylučují samoprůnik. U MVP využij invariant pozitivního radiálního povrchu s monotónními výškami a jednoduchými prstenci; při triangulaci kontroluj překřížení nebo převrácení buněk. Ve fixture sadě doplň nezávislou kontrolu průniků neincidentních trojúhelníků, například pomocí prostorové akcelerace. Budoucí transformace mimo tuto rodinu potřebují obecnější validátor před tím, než budou exportovatelné.

Numerické tolerance odvoď od měřítka modelu a popiš je v testech. Sousední plochy se sdílenou hranou či vrcholem se nesmí hlásit jako samoprůnik jen kvůli legitimnímu dotyku.

## 7. Three.js náhled a editor

Layout: nastavení tvaru vlevo, velký náhled uprostřed, souhrn rozměrů, analýzy a exportu v samostatném panelu. Na menším displeji se panely skládají pod sebe. První cílová platforma je desktopový prohlížeč.

Náhled má neutrální materiál, přiměřené světlo, mřížku podložky, směr +Z a vizuálně odlišený krček. Nabídne orbit/pan/zoom, reset kamery, tiskový pohled, volitelný zavěšený pohled a zapnutí mapy rizik s legendou. Při změně parametru kamera zachová uživatelský pohled; automatické přerámování prováděj při prvním zobrazení a explicitním resetu.

Rozměry uváděj v mm včetně celkové výšky a skutečného bounding boxu. Náhled může vypadat jako solid těleso; text u exportu vysvětlí výslednou jednu stěnu podle sliceru. Případný řez nebo vizualizace jedné stěny je ilustrace, nikoli náhled skutečného G-code.

Formulář podporuje psaní i slidery, viditelné jednotky, popisky pro asistivní technologie a ovládání klávesnicí. Změny průběžně ukládej lokálně s debounce; nedostupné úložiště nebo WebGL zobraz jako srozumitelný stav. Při výpadku WebGL má validace parametrů a stažení generovatelného STL nadále fungovat.

Při nové revizi zobraz „Přepočítávám“ a zneplatni staré analytické hodnocení. Starší náhled může dočasně zůstat viditelný, musí být však označen. Uvolňuj zaniklé geometrie, materiály a object URL.

## 8. Kontrola převisů a vhodnosti pro vase tisk

Analýza je **geometrický odhad pro zadané tiskové předpoklady**. Nehodnotí úplně chlazení, rychlost, reálný průřez extruze, pružnost ani adhezi. Stav „Nízké geometrické riziko“ není garance tisku. Použij toto označení místo „100% tisknutelné“.

### 8.1 Převis podle normály

Počítej z geometrických normál trojúhelníků v tiskové soustavě, nikoli z vyhlazených normál materiálu. Pro jednotkovou vnější normálu `n`:

```text
alpha = asin(clamp(-n.z, 0, 1)) * 180 / π
```

Úhel je **od svislé stěny**: svislá stěna 0°, vodorovná spodní plocha 90°. Horní plochy bez záporné složky normály mají v tomto testu 0°. Úhel nad zvoleným limitem označ jako riziko vnějšího rozšiřování.

Spodní disk na podložce vyřaď z hodnocení převisů. Označený horní uzavírací disk patří do zvláštního posouzení zakončení. Sleduj počet rizikových ploch, ale jako hlavní souhrn zobraz plochou vážený podíl a rozsah Z; počet trojúhelníků závisí na triangulaci.

Tato mapa nestačí pro rychlé zkroucení ani prudké zužování. Proto je povinná i následující kontrola.

### 8.2 Posun obrysu mezi vrstvami

Vzorkuj průřezy podle nastavené výšky vrstvy nezávisle na rozlišení náhledu. Kontroluj horní a dolní hranici intervalu i mezivrstvy podle křivosti, aby ostrý náběh neunikl mezi dvěma vzorky. Nad spodními plnými vrstvami pro každý bod vyššího obrysu hledej nejbližší bod na **úsečkách** předchozího obrysu, nikoli pouze nejbližší vrchol.

```text
d = vzdálenost vyššího obrysu od předchozího obrysu v XY
overlapEstimate = clamp(1 - d / extrusionWidth, 0, 1)
```

Jde o aproximaci překryvu dvou stejně širokých pásů. Obrysy STL nejsou přesné osy extruzních drah; offset sliceru a spiralizace mohou výsledek změnit. Analýza tuto nejistotu výslovně přiznává. Pro šikmá a zvlněná žebra nepoužívej jen rozdíl `r(theta, z) - r(theta, z-h)` jako rozhodující metriku; nejbližší bod může být v jiném úhlu.

Vyhodnoť obě směrové vzdálenosti mezi sousedními obrysy: z vyššího na nižší a z nižšího na vyšší. První odhaduje dostupnou oporu nové vrstvy, druhá odhalí prudké stažení a zánik lokálních detailů. Report zachová význam obou metrik. U změny znaménka rozliš rozšiřování a zužování; prudké zužování se nesmí považovat za bezrizikové jen proto, že jeho normály směřují nahoru.

Pod `minOverlapRatio` vydej varování, při `d >= extrusionWidth` vysoké riziko ztráty překryvu. Pro vysoké žebrování doplň varování na lokální poloměr křivosti/detail menší než řád šířky extruze: jednoduchý geometrický obrys může slicerovým offsetem přijít o detaily či změnit průchodnost.

Pro kontrolní případ kuželu musí metoda souhlasit s `d = h * |dr/dz|`. Zmenšení vrstvy při stejné síti zlepší odhad překryvu, ale nezmění normálový úhel. To je povinný regresní test oddělení obou metod.

### 8.3 Krček, zakončení a souvislost

- Ověř jeden jednoduchý obrys v každé neterminální výšce těla a absenci vnitřních dutin v modelu. Rozděl analýzu na krček, rozšiřování, hlavní tělo a zakončení.
- U krčku zobraz velikost základny a doporučení zvážit brim. Aplikace bez profilu tiskárny nepotvrzuje adhezi; tisknutý brim řeší slicer, nikoli přidaná geometrická příruba v STL.
- Pro konečný průměr zakončení zobraz „Ve vase režimu může na konci zůstat otvor přibližně podle tohoto průřezu; ověřte ve sliceru a výtiskem.“ Neoznačuj jej za automaticky zacelený.
- U velmi malých posledních obrysů připomeň riziko přehřívání a vynechání detailu slicerem. Meze pro „malý obrys“ jsou konfigurovatelná heuristika v násobcích šířky extruze, nikoli fyzikální záruka.
- Krček a případná objímka se analyzují samostatně. Přítomnost objímky v montážním náhledu nesmí vytvořit druhý objekt v STL těla.

### 8.4 Výsledky a exportní politika

| Stav | Chování |
| --- | --- |
| Neplatné parametry nebo vadná síť | STL se nevytvoří; UI uvede konkrétní chybu |
| Analýza čeká nebo selhala | Stav „Nevyhodnoceno“; žádné zelené hodnocení |
| Validní síť, nízké geometrické riziko | Běžné stažení s instrukcemi pro slicer |
| Validní síť, varování/vysoké riziko | Stažení zůstává možné, vedle tlačítka jsou viditelné důvody |

Export finální sítě vždy provede geometrickou validaci a pokus o finální analýzu dané revize. Když analýza selže, lze geometricky validní soubor stáhnout jako „STL bez dokončené analýzy“; stav je explicitní. Během rozpracovaného exportu se nové parametry nesmí zaměnit s už zamrazenou revizí.

Pro každé upozornění připoj akční doporučení: snížit amplitudu či twist, prodloužit přechod, zvětšit výšku těla, změnit krček nebo přezkoumat vrstvu/šířku extruze. Přepočet při změně tiskových vstupů nesmí zbytečně měnit samotnou geometrii.

## 9. Solid STL a ukládání parametrů

Výchozí export je binární STL jedné validované komponenty těla. Souřadnice exportuj v mm, s krčkem dole a minimem Z rovným nule. STL jednotky neukládá; uživatel musí při importu zachovat interpretaci v mm, viz [Three.js STLExporter](https://threejs.org/docs/pages/STLExporter.html).

Předmět exportu je explicitně tělo baňky, nikoli celá zobrazovací scéna. Podložka, rozměrové čáry, osy, barevná legenda a objímka se do souboru nedostanou. Normalizace a transformace souřadnic se aplikují právě jednou.

Pro čistý worker lze napsat malý binární STL encoder nad validovanou sítí: 80bajtová hlavička, 32bitový počet trojúhelníků little-endian a 50 bajtů na trojúhelník. Alternativou je `STLExporter` nad izolovanou exportní geometrií; výběr nesmí propojit doménový model s celou scénou.

Při převodu do float32 znovu ověř exportované souřadnice a ztrátu přesnosti, degenerace a bounding box. Pro testy načti soubor nezávislým parserem, svař topologicky stejné vrcholy definovanou tolerancí a porovnej objem, orientaci, uzavřenost a rozměry. STL samotné neuchovává indexy sdílených vrcholů.

Název například `bulb-elongated-56x96-neck14.stl`, kde 96 je skutečná celková výška. Parametry nabídni jako samostatný `*.json`: `schemaVersion`, `generatorVersion`, parametry tvaru a tiskové předpoklady. Do STL se šířka extruze ani počet spodních vrstev nepřenášejí. JSON import musí obnovit stejnou geometrii a stejné předpoklady analýzy.

## 10. Samostatná objímka a rozhraní uchycení

### Co musí připravit už MVP

Celý přímý krček je kruhový, bez žeber a zkroucení. Parametry objímky odvozuj od jeho vnějšího průměru a dostupné přímé délky; nesmí být navázané na průměr těla. Dosedací délka musí končit před začátkem ramene a počítat s rezervou u podložky kvůli rozšíření první vrstvy.

Protože je krček nad spodními vrstvami tenkostěnný, silový press-fit nebo západka mohou stěnu poškodit. Výchozí implementační návrh proto začíná volněji nasazovanou objímkou pro kalibrované/lepené uchycení; čistě mechanické držení je samostatně ověřovaná varianta. Toto je nové návrhové rozhodnutí, nikoli již potvrzený detail původní konverzace.

### První generovaná varianta ve fázi 5

Navrhni krátký prstenec kolem krčku s bočním integrovaným ouškem s průchozím otvorem pro háček/provázek. Jeho průřez v rovině XY lze vytvořit jako sjednocení vnějšího kruhu prstence a kruhového ouška, s odečtením otvoru krčku a otvoru ouška, a celý 2D profil extrudovat do výšky dosedací délky. Ouško a prstenec musí mít kladný materiálový překryv, nikoli jen tečný dotyk.

Tím vznikne jeden uzavřený solid díl tisknutelný naplocho běžným režimem. K triangulaci 2D profilu s otvory využij prověřenou knihovnu; pouhé překrytí dvou samostatných STL těles není dokončená objímka. Obecný 3D CAD kernel není pro tuto variantu nutný.

Počáteční parametry:

| Parametr | Návrhový začátek |
| --- | --- |
| Dosedací délka | 5 mm pro krček délky 8 mm |
| Radiální vůle `c` | +0,15 mm pro nasazovací/lepenou variantu |
| Vnitřní průměr | `neckDiameter + 2*c`; vůle je radiální, nikoli průměrová |
| Tloušťka prstence | 1,8 mm, s ověřením podle běžného tiskového profilu |
| Průměr otvoru ouška | 3 mm |
| Materiál kolem otvoru | nejméně 1,5 mm, ověřit kalibračním výtiskem |

Kladná vůle není press-fit a sama nezaručuje držení. Experimentální zápornou vůli případně zpřístupni až po kalibraci; výchozí profil ji nevyžaduje. Kalibrační sada má nabídnout několik vůlí, například +0,05 / +0,10 / +0,15 / +0,20 / +0,25 mm.

Objímka má vlastní tlačítko exportu a vlastní instrukce běžného tisku. Pro testovací začátek použij více perimetrů a horní/spodní plné vrstvy podle materiálu; **vase mode pro objímku nepoužívej**. V montážním náhledu může být vedle baňky, ale exportuje se odděleně. Eulerova charakteristika 2 předepsaná pro tělo se na objímku s průchozími otvory nevztahuje; kontrola její uzavřené orientovatelné sítě ano.

Ve fyzickém ověření zkontroluj nasazení bez prasknutí, držení, polohu ouška a úhel zavěšené baňky. Boční očko může měnit vyvážení. Klasická krycí čepička s centrálním očkem, kovová standardní objímka, závit či zacvakávací lem jsou další varianty; nemají oddálit první funkční rozhraní.

## 11. Postupné fáze a acceptance criteria

### Fáze 0 — průchod od geometrie ke sliceru

**Cíl:** odstranit největší technickou nejistotu před stavbou editoru.

Vytvoř minimální čistě TypeScript generátor hladkého těla s krčkem, uzavřením obou konců a binárním exportem. Vyrob protáhlý výchozí profil a krátký široký profil s očekávaným rizikem. Importuj je do PrusaSliceru, pokud je dostupný, a prohlédni dráhu od krčku po zakončení.

Výstupy: minimální spustitelný generátor, dvě JSON fixture a STL, záznam v `doc/verification/phase-0.md` s verzí sliceru, použitým profilem, snímky a závěrem pro rameno a špičku.

Acceptance criteria:

- [ ] Výchozí STL má jednu uzavřenou komponentu, kladný objem a očekávané rozměry v mm.
- [ ] První řez má jen kruhový krček na Z = 0; tělo se nezačíná tisknout jako samostatný ostrov.
- [ ] Slicer nevyžaduje opravu sítě a nad spodními vrstvami vytvoří jednu souvislou obvodovou dráhu.
- [ ] Je zdokumentováno, co se skutečně stane v posledních vrstvách a zda zůstává otvor.
- [ ] Krátký široký profil je odlišen jako rizikový; záznam nepovažuje přijetí STL slicerem za potvrzení fyzického tisku.
- [ ] Pokud slicer není dostupný, existují připravené soubory a přesný postup a příslušná brána zůstává otevřená.

### Fáze 1 — základ aplikace a kanonická geometrie

**Cíl:** reprodukovatelný projekt a geometrický základ nezávislý na UI.

Založ React/TypeScript projekt, schéma parametrů, tři presety, čisté funkce profilu a indexovanou triangulaci. Přidej geometrickou validaci a základ worker protokolu. Výsledky experimentu z fáze 0 promítni do výchozích hodnot.

Acceptance criteria:

- [ ] Z čisté instalace projde typecheck, relevantní testy a produkční build.
- [ ] Všechny tři presety generují uzavřený solid se správnými souřadnicemi a bez degenerací.
- [ ] Extrémy podporovaných parametrů buď projdou validací, nebo vrátí strukturovanou chybu; neukončí aplikaci výjimkou.
- [ ] Síť má pro tělo jednu komponentu, dvě plochy na každé hraně, konzistentní orientaci a Eulerovu charakteristiku 2.
- [ ] Deterministické vstupy vytvářejí stejnou síť ve stejném rozlišení.
- [ ] Test objemu a bounding boxu referenčního válce odhalí chybu orientace nebo jednotek.
- [ ] Worker zprávy mají revize a test dokládá zahození opožděné odpovědi.

### Fáze 2 — editor, transformace a Three.js náhled

**Cíl:** uživatel upraví vlastní tvar a jeho náhled odpovídá parametrickému modelu.

Implementuj panely, číselná pole, slidery, presety, reset, žebrování, twist, ochranné obálky a ovládání náhledu. Přidej aktualizace přes worker a lokální uložení parametrů.

Acceptance criteria:

- [ ] Každá změna validního vstupu vytvoří odpovídající revizi náhledu; nevalidní rozepsané pole zůstane ve formuláři s chybou.
- [ ] Měření několika průřezů potvrzuje počet žeber, amplitudu a směr zkroucení.
- [ ] Krček má po libovolné podporované povrchové transformaci stejný průměr, délku a kruhový průřez.
- [ ] Při nulové amplitudě twist nemění síť nad toleranci numeriky.
- [ ] Tiskový pohled, podložka a reset kamery jsou funkční; otočení pohledu nemění geometrii v tiskové soustavě.
- [ ] Po 100 úpravách neroste počet živých Three.js geometrií a materiálů s každou revizí.
- [ ] Klávesnice umožní změnit parametry a aktivovat základní akce bez myši.

### Fáze 3 — tisková analýza a mapa rizik

**Cíl:** uživatel rozumí konkrétním rizikovým místům a vlivu tiskových vstupů.

Implementuj normálový test, analýzu sousedních průřezů, výjimku podložky, posouzení zakončení a strukturovaný report. Vyřeš legendu, textové zprávy a jejich lokalizaci v náhledu.

Acceptance criteria:

- [ ] Svislý válec má na plášti úhel 0°; jeho podstava na podložce nevyvolá převis.
- [ ] Rozšiřující kužel s analyticky známým sklonem souhlasí s očekávaným úhlem do 1°.
- [ ] Zužující kužel má nízký normálový převis, ale při velkém posunu vrstev vyvolá upozornění na překryv.
- [ ] Twist se stejnou amplitudou může zhoršit analýzu sousedních obrysů; příslušná fixture to prokazuje.
- [ ] Poloviční výška vrstvy zlepší odhad překryvu kuželu a nezmění jeho normálový úhel.
- [ ] Změna pouze šířky extruze přepočte report, ale nezmění síť ani STL těla.
- [ ] Report i barvy odpovídají aktuální revizi; čekající a selhaný výpočet mají samostatný stav.
- [ ] Legenda uvádí definici úhlu a omezení odhadu; zakončovací disk nezakrývá zprávu o skutečném vase otvoru.

### Fáze 4 — export, reprodukovatelnost a MVP ve sliceru

**Cíl:** stažený soubor odpovídá navržené baňce a existuje ověřený postup tisku.

Dokonči jemný export, finální validaci, download, JSON round-trip a průchozí testy. Proveď slicerovou matici v kapitole 12 alespoň v PrusaSliceru.

Acceptance criteria:

- [ ] Stažený STL lze nezávisle načíst; je uzavřený a jeho bounding box se liší od očekávání nejvýše o 0,05 mm.
- [ ] STL neobsahuje podložku, osy, objímku ani vnitřní skořepinu.
- [ ] Náhled a export vycházejí ze stejných parametrů; rozdíl triangulace splňuje stanovenou toleranci.
- [ ] Export během editace nezamění revize a název souboru odpovídá exportovaným rozměrům.
- [ ] JSON export/import obnoví tvar i analytické předpoklady; neznámé a vadné vstupy se odmítají.
- [ ] Topologická chyba blokuje STL, tiskové varování ponechá export možný s vysvětlením.
- [ ] Po zapnutí vase režimu je nad spodními vrstvami jediná obvodová dráha, bez vnitřní stěny a bez dalších ostrovů.
- [ ] Záznam testů sliceru uvádí skutečné výsledky, verzi a profily; každý neověřený bod má viditelný stav.

### Fáze 5 — generátor samostatné objímky

**Cíl:** vytvořit kompatibilní tisknutelný díl bez zásahu do solid exportu baňky.

Implementuj extrudovaný prstenec s ouškem, parametry vůle, samostatný export a volitelný montážní náhled. Připrav kalibrační sadu pro skutečný krček.

Acceptance criteria:

- [ ] Změna průměru krčku aktualizuje vnitřní průměr objímky podle radiální vůle.
- [ ] Všechny exportovatelné objímky mají jeden souvislý uzavřený materiálový objem a zachované funkční otvory.
- [ ] Ouško je materiálově propojené s prstencem a v běžném sliceru nevzniká samostatný ostrov.
- [ ] Objímka se vejde na přímou část krčku a nezasahuje do ramene.
- [ ] Export těla je bitově či geometricky nezměněn zapnutím montážního náhledu.
- [ ] Dokumentace rozlišuje nasazovací/lepenou a experimentální svěrnou variantu; kladná vůle není označena jako press-fit.
- [ ] Běžný slicing objímky zachová otvor pro krček i háček; kalibrační STL jsou připravené.

### Fáze 6 — fyzické ověření a dokončení první použitelné sady

**Cíl:** doložit tisk a uchycení u konkrétních konfigurací, nikoli pouze matematickou validitu.

Vytiskni referenční hladkou baňku a jednu žebrovanou variantu s objímkou. Pokud tiskárna není dostupná, připrav předávací balíček a vyčkej na manuální výsledky této části; nezávislé opravy aplikace a dokumentace mohou pokračovat.

Acceptance criteria:

- [ ] Záznam obsahuje tiskárnu, materiál, trysku, skutečnou vrstvu, šířku extruze, teploty, chlazení, rychlost a použitý slicer/profil.
- [ ] Fotografie a poznámky pokrývají základnu krčku, rameno, žebra a poslední vrstvy.
- [ ] Je změřeno zakončení/otvor a popsáno, zda se ponechává otevřené; případná zátka je označena jako další díl mimo základní vase tělo.
- [ ] Objímka se nasadí bez poškození krčku a ověří se zvolený způsob uchycení.
- [ ] Předem zaznamenaný interní test držení, například pětinásobek vlastní hmotnosti baňky po dobu 10 minut, projde bez sesunutí či prasknutí; záznam uvádí také způsob lepení, pokud byl použit.
- [ ] Je zdokumentováno vyvážení při zavěšení a vliv bočního ouška.
- [ ] Alespoň jedna úprava amplitudy nebo twistu je porovnána s odhadem aplikace; zjištěné odchylky jsou promítnuty do heuristik nebo dokumentace.
- [ ] Žádný test bez fyzického provedení není označen jako ověřený výtiskem.

### Po MVP a ověřené sadě

Další profily a špičky, klasická čepička s centrálním očkem, pozitivní mechanické jištění objímky, další periodické deformace, alternativní tisková orientace a sdílení parametrů přes URL. Přidávej je s novými geometrickými a slicerovými fixtures, ne pouze jako další ovladače UI.

## 12. Verifikace ve sliceru

### Referenční postup

Použij PrusaSlicer jako primární ověření. Pro rozšíření kompatibility zopakuj klíčové případy v OrcaSliceru. Jeho [oficiální popis spiral vase](https://github.com/OrcaSlicer/OrcaSlicer/wiki/others_settings_special_mode) potvrzuje stejný princip jedné spirálové stěny ze solid modelu; konkrétní dráhu je stále nutné zkontrolovat.

1. Zaznamenej verzi sliceru, tiskárnu a výchozí profil. Importuj jeden STL těla v měřítku 100 % a v mm.
2. Ověř rozměry a krček na podložce. Vypni automatické přeorientování, které by orientaci změnilo.
3. Aktivuj skutečný spiral vase režim. Ověř jednu stěnu, nulovou výplň, nulové horní vrstvy a žádné podpěry. Spodní vrstvy a šířku extruze nastav podle testovacího případu.
4. Zkontroluj, že minimální tloušťka dna nebo další profilové pravidlo nezvýšilo počet spodních vrstev proti předpokladu aplikace.
5. Prohlédni první vrstvy, přechod od plného dna ke spirále, rameno, maximum těla, žebra a poslední obvody.
6. Ověř počet obrysů, vnitřní stěny, retrakce/cesty naznačující přerušení a vynechané drobné prvky. Samotná nepřítomnost varování sliceru nestačí.
7. Prohlédni vývoj Z na dráze nad dnem, aby šlo skutečně o spiralizaci. Je-li potřeba, použij G-code viewer; běžný pohled na model to nedokládá.
8. Zaznamenej skutečnou podobu poslední vrstvy a otvoru; nevynucuj top solid vrstvy jako skryté obejití vase režimu.
9. Ulož projekt/profil a snímky kritických míst. Soubory označ ID případu, hashem parametrů a verzí generátoru. Velké G-code soubory do repozitáře ukládej jen pokud mají jasnou diagnostickou hodnotu.
10. Objímku načti zvlášť a ověř běžným režimem; nikdy ji nepřidávej jako druhý vase objekt v témže jobu.

### Minimální matice případů

| ID | Konfigurace | Co má test odhalit |
| --- | --- | --- |
| S01 | Výchozí protáhlá, hladká | Průchozí neck-first model, jediný obrys, zakončení |
| S02 | Zaoblená, kratší a širší | Rizikové rozšiřování od krčku |
| S03 | Kapka | Odlišná poloha maxima a průběh zužování |
| S04 | 12 žeber, amplituda 1 mm, twist 0° | Zachování detailů a kruhového krčku |
| S05 | Stejné jako S04, twist 120° | Vliv twistu na sousední obrysy |
| S06 | Vysoká amplituda a krátký náběh | Záměrně varovná kombinace a správné označení v UI |
| S07 | S01 při vrstvě 0,10 a 0,25 mm | Analýza se mění s vrstvou, síť těla zůstává stejná |
| S08 | Nejmenší a největší validní exportní rozměry | Přesnost, jednotky a stabilita generování |
| S09 | Nejmenší a největší podporované zakončení | Vynechání posledního detailu, koncový otvor |
| C01 | Objímka, nominální krček a série vůlí | Otvory, materiálové propojení, skutečné dosednutí |

S06 nemá „projít bez rizika“; úspěchem je reprodukovatelné upozornění a záznam skutečné dráhy. U každého případu rozliš očekávanou geometrickou vlastnost, analytický výsledek, výsledek sliceru a výsledek výtisku.

Šablona záznamu:

```text
ID případu / datum / autor ověření:
Verze generátoru / commit / hash parametrů:
JSON a STL:
Geometrická validace:
Vstupy a výsledek analýzy aplikace:
Slicer, verze, tiskárna a profil:
Skutečná výška vrstev, šířka extruze, spodní vrstvy:
Počet obrysů, dráha nad dnem, rameno, zakončení:
Snímky / uložený projekt:
Fyzický tisk: provedeno / neprovedeno:
Závěr / rozdíly proti odhadu / další úprava:
```

## 13. Automatické testy a výkon

### Geometrie a export

- Referenční válec a kužel: rozměry, objem s tolerancí polygonální aproximace a orientace ploch.
- Všechny presety a meze: pozitivní poloměr, kontinuita profilu, chráněný krček, přesné uzávěry.
- Pevná reprodukovatelná sada alespoň 50 kombinací parametrů: validní síť nebo očekávané odmítnutí. Testuj kombinace amplitudy, krátkého náběhu a twistu, nikoli jen jednotlivé parametry.
- Uměle poškozené sítě: chybějící plocha, obrácená plocha, duplicitní trojúhelník, nulová plocha, špatný index a samoprůnik. Každá má očekávanou detekci příslušné třídy chyby.
- STL round-trip: délka binárního souboru `84 + 50 * triangleCount`, konečné float32 souřadnice, správné rozměry a obnovená uzavřená topologie.
- Přesnost zjemňování: náhodně i cíleně vzorkované body v problematických buňkách odpovídají deklarované toleranci.

### Analýza a aplikační průchod

- Analyticky známé úhly válce a kuželů, správná definice úhlu a výjimka podložky.
- Změna vrstvy a šířky extruze má očekávaný vliv na překryv, bez změny geometrie.
- Výsledky analýzy se významně nemění pouze změnou pracovní triangulace; stanov toleranci metrik na fixtures.
- E2E: otevřít editor → změnit rozměr → zapnout žebra → zobrazit report → stáhnout a načíst STL.
- E2E: export/import JSON, nevalidní JSON, rychlé editace se starými odpověďmi workeru a selhání WebGL.

### Cílové rozpočty

Na zaznamenaném referenčním desktopu a prohlížeči, po zahřátí aplikace, měř alespoň 20 změn a uváděj p95. Rozpočty jsou přijímací cíle, nikoli tvrzení o naměřeném výkonu:

| Operace | Cíl |
| --- | --- |
| Odezva formuláře během výpočtu | bez blokování hlavního vlákna delšího než 100 ms výpočtem geometrie |
| Pracovní náhled výchozího modelu po změně | do 300 ms včetně debounce |
| Analýza výchozího modelu | do 1 s |
| Jemný export výchozího modelu | do 3 s |
| Nejnáročnější podporovaný případ | viditelný průběh / možnost zrušení, cíl do 10 s |

Pracovní debounce začni na 80–120 ms. Zastaralé výpočty koaleskuj nebo ruš; samotné zahazování výsledků nesmí vytvořit dlouhou frontu. Dlouhou synchronní práci workeru ruš po blocích nebo ukončením a obnovením workeru. Pokud měření cíle nesplní, zdokumentuj důvod a proveď cílenou úpravu; nesnižuj potichu přesnost exportu.

## 14. Orientační pracnost a rizika

Odhad pro jednoho zkušeného React/TypeScript vývojáře s pomocí Codexu, v prázdném repozitáři. Jde o návrhový odhad tohoto zadání, ne o závazný termín. Čekání na tiskárnu, několikahodinové tisky a jejich opakování nejsou zahrnuty do čistého času vývoje.

| Fáze | Aktivní práce |
| --- | --- |
| 0 — experiment a první slicing | 1–2 pracovní dny |
| 1 — základ a geometrie | 2–3 dny |
| 2 — editor a náhled | 2–4 dny |
| 3 — analýza | 3–5 dní |
| 4 — export a slicerové ověření MVP | 2–3 dny |
| MVP celkem | přibližně 10–17 pracovních dní |
| 5 — objímka | 2–4 dny |
| 6 — fyzické ověření a úpravy | 2–4 dny aktivní práce + čekání na tisky |

Pro kompletní ověřenou sadu počítej s 14–25 pracovními dny aktivní práce a rezervou 25–40 % na geometrii, výkon a iterace uchycení. Největší nejistota je fyzické chování krčku/ramene a zakončení, nikoli samotné vykreslení ve Three.js.

| Riziko | Opatření |
| --- | --- |
| Rameno se od krčku rozšiřuje příliš rychle | Fáze 0, delší přechod, analýza vrstev, varovný široký preset |
| STL je uzavřené, ale výtisk má koncový otvor | Samostatné posouzení zakončení, slicing a fyzické měření |
| Zkroucení ztratí oporu i při přijatelném běžném převisu | Nejbližší vzdálenost sousedních obrysů, ne pouze normály |
| Jemné žebrování slicer vyhladí nebo odstraní | Kontrola detailu proti extruzi a porovnání dráhy s modelem |
| Objímka praskne nebo zmačkne tenký krček | Série vůlí, nasazovací/lepená první varianta, test uchycení |
| Náhled odpovídá jiné revizi než export | Neměnné parametry, request ID, revize a zamrazený export |
| Slicer opravuje chybný mesh a maskuje chybu generátoru | Vlastní topologická validace a zákaz považovat opravu za úspěch |

## 15. Definition of Done a první implementační úloha

MVP je dokončeno, když uživatel v čistém desktopovém prohlížeči bez backendu vytvoří podporovaný tvar, prohlédne aktuální náhled a report, stáhne validní solid STL i JSON a referenční případy mají doložený slicing. Vývojová dokumentace umožní reprodukovat instalaci, testy, build, export a slicerovou kontrolu. Stav fyzického ověření je viditelný a oddělený.

Kompletní první sada navíc zahrnuje samostatnou objímku, kalibrační podklady a zdokumentovaný výtisk s funkčním zavěšením. Žádné splněné automatické kritérium nenahrazuje manuální výsledek, který skutečně nebyl proveden.

**První úloha pro Codex:** implementuj fázi 0 a minimální infrastrukturu nutnou k jejímu spuštění. Vygeneruj dva referenční solid STL a odpovídající JSON, proveď geometrické kontroly a připrav nebo proveď slicerovou kontrolu podle dostupnosti prostředí. Do stavového dokumentu zapiš skutečné výsledky a zjištěné úpravy profilu. Potom pokračuj fází 1 s přihlédnutím k výsledkům brány; další fáze nepovažuj za splněné předčasně.

## 16. Technické zdroje

Externí zdroje byly kontrolovány při přípravě 24. 10. 2026. Výše uvedené vzorce, heuristiky, rozměry, acceptance criteria a pracnost jsou návrhem tohoto zadání, nikoli tvrzením o doporučení jejich autorů.

- [PrusaSlicer — Layers and perimeters / Spiral vase](https://help.prusa3d.com/article/layers-and-perimeters_1748): solid vstup a princip vase režimu.
- [OrcaSlicer — Special Mode / Spiral vase](https://github.com/OrcaSlicer/OrcaSlicer/wiki/others_settings_special_mode): druhý cílový slicer a jeho spiralizace.
- [Three.js — STLExporter](https://threejs.org/docs/pages/STLExporter.html): binární export a absence jednotek v STL.
- [Three.js — BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html): síť pro renderování.
- [React Three Fiber — Introduction](https://r3f.docs.pmnd.rs/getting-started/introduction): React renderer a kompatibilita s Reactem.
- [Vite — Getting Started](https://vite.dev/guide/) a [Features](https://vite.dev/guide/features.html): základ aplikace a podpora workerů.
- [MDN — Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers): výpočty mimo hlavní vlákno a přenos dat.
