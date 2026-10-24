# Povrchové transformace a přehlednější nastavení

Předchozí dva tvary a průběhy transformací jsou v commitu `ffbb71e`. Následující rozšíření přidává tvar žeber (oblá, úzké vrcholy, široké vrcholy), pootočení vzoru 0–360° a nezávislé vodorovné vlny (hloubka 0–2 mm, 1–12 period po výšce a posun 0–100 % periody). Vlny lze zapnout i bez žeber. Napojení krčku a zakončení je chráněné společnou obálkou.

UI je rozdělené na tělo, žebra, zkroucení, vodorovné vlny, krček a napojení/zakončení. Obsahuje vysvětlení jednotek a účinku, stavy aktivních transformací, samostatné resety a automatické otevření sekcí s chybami. Rozpracované volby se zachovají i při neplatném číselném vstupu; poslední platná geometrie a exportní blokace se nemění. Reset jedné sekce nesmaže rozměry ani ostatní transformace. Vše se ukládá do JSON i místního úložiště. Staré JSON doplňují neutrální hodnoty; původní hladké STL zůstávají beze změny.

Analýza 1.2.0 sdílí s generátorem konzervativní meze derivací, doplněné o druhou harmonickou tvaru žeber a výškovou sinusovku. Používá skutečné derivace nového profilu žeber i pro lokální křivost. Společná kontrola kladnosti poloměru posuzuje součet hloubek žeber a vln. Nové vzorce jsou v `../geometry.md`.

Ověření:

- Rozsah a šířka vrcholů, analytické derivace, perioda a pootočení žeber; 360° odpovídá 0°.
- Vlny bez žeber, analytická hloubka, fáze, chráněné konce, kritické čtvrtiny period a vliv na mezivrstvovou analýzu; 100 % odpovídá 0 %.
- Vypnuté transformace bitově nemění STL. Součet deformací nemůže projít přes osu bez explicitního odmítnutí.
- Dalších 18 kombinací obou nových tvarů, tří tvarů žeber a tří twistů s aktivními vlnami: topologie, odchylka uvnitř obou trojúhelníků buněk a nezávislé numerické kontroly druhých/míšených derivací parametrického povrchu vůči analytickým mezím.
- Nezávislé BVH ověření průniků celého kombinovaného exportu. STL round-trip vln a skutečného kombinovaného souboru staženého z prohlížeče.
- Reducer: oddělené resety a zachování zvoleného tvaru žeber přes neplatný počet vln. Playwright: sekce, ukládání/reload, skutečné JSON/STL, resety a oprava neplatných vstupů v mobilním panelu.

Snímek `transform-sections.jpg` pochází z procházejícího E2E scénáře. Slicerové ani fyzické ověření této sady zatím nebylo provedeno. Vyšší hloubka či počet vln mohou zhoršit převisy a oporu stejně jako žebra; limity triangulace a analýzy zůstávají explicitní.
