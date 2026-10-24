# Vejce, diamant a průběhy transformací

Přidány dvě skutečné profilové funkce: vejce s kosinovým přechodem a zaoblený diamant s rovnými středními úseky boků. Výchozí rozměry těla jsou 56 × 76 mm a 56 × 90 mm; s krčkem 14 × 8 mm jde o celkovou výšku 84 / 98 mm. Zakončení zůstává R1,2 mm. Původní tři profily a jejich nastavení se zachovávají.

UI nabízí posun maxima 30–70 % od krčku, obálku žeber po celé výšce / uprostřed / u krčku a plynulý / rovnoměrný / vratný twist. Při vratném twistu je zadaný úhel maximem v polovině těla, na konci se žebra vrátí. Krček zůstává kruhový a chráněný; při nulové amplitudě transformace bitově nemění síť.

Analýza 1.1.0 a triangulace používají společné konzervativní derivace a kritické výšky. Vzorce a meze jsou v `../geometry.md`. JSON schemaVersion 1 přijímá staré soubory bez nových polí a doplní `uniform`/`smooth`; nově uložené JSON zachovají obě volby. Změnily se proto vstupní hashe fixture, ale SHA-256 původních S01/S02 STL zůstaly stejné. Jejich dřívější slicerový záznam se vztahuje ke stejným STL bajtům.

Automatické ověření zahrnuje:

- Samostatné float32 STL round-tripy vejce a diamantu, rozměry, uzavřenost, monotónnost a odlišnost profilů; nulový sklon rozhraní a rovné úseky diamantu.
- Všech 18 kombinací dvou tvarů, tří obálek a tří twistů: validita sítě, prostorová odchylka uvnitř obou trojúhelníků buněk do 0,05 mm a kontrola druhé derivace radiální funkce vůči mezi pro mezivrstvové vzorkování.
- Nezávislé BVH testy průniků celých exportních sítí obou nových presetů a žebrovaného diamantu s vratným twistem.
- Zpětná kompatibilita starého JSON, shodné STL původního presetu, striktní neznámé hodnoty, procentní editor a reset transformací.
- Playwright: přepnutí tvarů, úpravy a reload, načtení skutečně staženého JSON a STL, bitová shoda STL s parametry tohoto JSON a mobilní nastavení/reset.

Snímky `egg-transformations.jpg` a `diamond.jpg` vznikly v Chrome z procházejících E2E scénářů. Rozšíření bylo ověřeno geometricky a v aplikaci, zatím ne slicingem či fyzickým tiskem těchto nových variant. Původní otevřené brány MVP zůstávají v `../IMPLEMENTATION_STATUS.md`.
