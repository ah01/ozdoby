# Fáze 3 — geometrická tisková analýza

24. 10. 2026. Algoritmus 1.0.0, generátor těla 0.1.0. Toto je geometrický odhad pro zadané předpoklady, nikoli potvrzení fyzického tisku.

## Implementace

- Normály skutečných trojúhelníků v tiskových souřadnicích: `asin(clamp(-nz, 0, 1))`, úhel od svislé stěny. Disk na podložce a horní uzávěr se vyřazují. Souhrn obsahuje plochou vážený podíl, maximální úhel, počet ploch a rozsah Z.
- Sousední obrysy se porovnávají nezávisle na triangulaci náhledu, obousměrně. Nejbližší bod leží na úsečce, nikoli jen na vrcholu nebo ve stejném úhlu. BVH nad uzavřeným obrysem urychluje přesné hledání vzdálenosti; test ho porovnává s nezávislým hrubým výpočtem všech úseček. Kruhové průřezy používají ekvivalentní přesné analytické vzdálenosti kružnic.
- Minimálně dvě mezivrstvová porovnání v každém nominálním intervalu, doplněná o uzly profilu a zjemnění podle horní meze druhé derivace. Test zachytí sinusovou odchylku, kterou by koncové řezy zcela minuly.
- Překryv: `clamp(1 - d / šířkaExtruze, 0, 1)`. Oba směry mají oddělené metriky; zužování se nezaměňuje s nízkým normálovým převisem. Znaménka radiálního posunu slouží jen k popisu rozšiřování/zužování, nikoli jako náhrada rozhodující nejbližší vzdálenosti.
- Samostatné zprávy pro otevřený konec, malý koncový obrys, křivost detailu, adhezi krčku a neobvyklé poměry trysky/vrstvy/extruze. Každá má kód, závažnost, případný rozsah Z, naměřenou hodnotu, limit a doporučení.
- Mapa barev kombinuje normály, obousměrný posun vrstev a špičku. Zprávy s rozsahem Z lze lokalizovat dvojicí zvýrazňovacích kruhů v náhledu. Tisková soustava se nemění přepnutím zavěšeného pohledu.

Editor odděluje koncepty geometrických a tiskových polí a jejich validaci/revize. Změna tiskových vstupů zachovává identitu parametrů těla. Analytický worker dostává kopii kanonické sítě; nepřenáší se vlastnictví polí používaných náhledem. Výsledek nese request ID, revizi, hash parametrů/předpokladů a verzi algoritmu. Neaktuální report ani barvy se nezobrazují jako aktuální. Čekání a selhání jsou samostatné stavy bez zeleného hodnocení.

Export vytváří jemnou síť, znovu ověří topologii a zkusí finální analýzu zamrazených parametrů i předpokladů. Tiskové varování export neblokuje. Selhání samotné analýzy ponechá geometricky validní STL dostupné s výslovným oznámením „bez dokončené analýzy“. Vadná geometrie nebo nevalidní vstupy STL blokují.

## Meze a nejistoty

Výchozí tolerance vzorkování obrysu je nejvýše 0,005 mm a zároveň nejvýše 2 % extruzní šířky. Úhlový počet vychází z horní meze druhé derivace a nejméně 16 vzorků na periodu žebra. Horní limit je 3 miliony dotazů vzdálenosti a 32 podintervalů na fyzickou vrstvu; překročení vrací strukturované `ANALYSIS_LIMIT` bez tichého zhrubnutí. Zastaralou synchronní práci UI zruší ukončením workeru.

Malé zakončení je konfigurovatelná heuristika: výchozí varování pod šestinásobkem šířky extruze, vysoké riziko pod dvojnásobkem. Malý poloměr křivosti se porovnává s jednonásobkem šířky extruze. Konfigurace je v `defaultAnalysisOptions`, není vydávána za fyzikální mez. Kontrola poměrů rozměrů trysky/vrstvy je upozornění, nikoli univerzální důkaz tisknutelnosti.

Dráhy STL nejsou přesné osy extruze; offset a skutečná spiralizace sliceru mohou odhad změnit. Chlazení, rychlost, materiál, adheze a deformace nejsou plně modelované. Uzavřený STL má vždy samostatnou zprávu o možném vase otvoru.

## Ověření

42 jednotkových testů prošlo. Nová sada dokládá válec s 0° a výjimkou podložky, rozšiřující kužel s 45° do 1°, zužující kužel s nulovým normálovým převisem a ztrátou překryvu, zlepšení po snížení vrstvy, mezivrstvové extrémy, rozdíl twistu, přesnost segmentového BVH, stabilitu metrik mezi pracovní a exportní sítí, aktuálnost hashů a validní STL při nedokončené analýze.

Tři nové Playwright scénáře prošly: změna tiskových předpokladů bez změny revize geometrie i STL bajtů; mapa svázaná s posledními vstupy a lokalizace oblasti; vynucené selhání analytického workeru bez blokace validního STL. Produkční build s oběma workery prošel. Předchozí šestice testů editoru z fáze 2 zůstává v sadě pro další regresní průchod.

Reprodukovatelné souhrny: `phase-3-report.json`, generované příkazem `npx --no-install tsx scripts/analyse-fixtures.ts`.

| Případ | Max. převis | Min. opora vyššího obrysu | Hodnocení |
| --- | --- | --- | --- |
| S01 hladká protáhlá | 35,33° | 59,4 % | Varování malého koncového obrysu |
| S02 krátká široká | 72,90° | 0 % | Vysoké geometrické riziko |
| S04 žebra 1 mm, twist 0° | 35,42° | 59,4 % | Varování |
| S05 stejná amplituda, twist 120° | 43,67° | 53,8 % | Varování, zhoršený překryv |
| S01 vrstva 0,10 mm | 35,33° | 79,7 % | Varování zakončení |
| S01 vrstva 0,25 mm | 35,33° | 49,2 % | Varování zakončení |

Jednotlivý diagnostický běh v Node včetně pracovní triangulace trval přibližně 12–36 ms pro hladké případy a 694 ms pro žebra/twist. Nejde o měření p95 ani o přijetí výkonnostního rozpočtu; to zůstává samostatnou úlohou fáze 4. Slicerová GUI brána a fyzický výtisk jsou nadále neprovedené.
