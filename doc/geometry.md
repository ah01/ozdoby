# Geometrický kontrakt a numerika

Generátor 0.1.0 používá profil a sinusové žebrování z implementačního plánu, rozšířené o vejce, diamant a průběhy transformací. Rozměry jsou v mm, krček leží na Z = 0 až `neck.lengthMm`. Původní tři presety používají kubický smoothstep, vejce kosinový profil a diamant zaoblený lineární profil. Všechny mají společný radiální generátor. Výchozí přesnost exportu je 0,05 mm; náhledu 0,2 mm. Na přání uživatele lze STL výslovně přepnout na hrubší 0,15 mm nebo jemné 0,02 mm. Jde o maximální prostorovou odchylku triangulace, nikoli výšku tiskové vrstvy; hrubší volba ustupuje od původního standardního požadavku 0,05 mm.

## Profily a transformace

Normalizovaný úsek profilu má parametr `t` v [0,1], změnu poloměru `D` a délku `L`. Všechny varianty jsou monotónní a mají nulový sklon na obou koncích, takže zachovají kruhové napojení krčku a maximum bez hrany.

| Profil | Interpolace | Mez první derivace podle t | Mez druhé derivace podle t |
| --- | --- | --- | --- |
| Původní presety | `3t² − 2t³` | 1,5 | 6 |
| Vejce | `(1 − cos(πt))/2` | π/2 | π²/2 |
| Diamant | Integrovaná rychlost: smoothstep náběh/doběh, uprostřed konstanta | `1/(1−e)` | `1.5/(e(1−e))`, e = 0,15 |

Pro diamant je na prvním úseku `f(t) = e/(1−e) * (q³ − q⁴/2)`, `q=t/e`; uprostřed `f(t)=(t−e/2)/(1−e)` a na posledním úseku `f(t)=1−f(1−t)`. Funkce i první dvě derivace navazují; úseky není nutné dělit v těchto přechodech, protože globální mez druhé derivace platí i přes ně. Poloha maxima `body.maxRadiusAt` je přístupná v UI jako 30–70 % výšky těla od krčku.

Amplituda je `A * B(z) * W(u)`, kde `B` je původní chráněný náběh/doběh a `u` normalizovaná výška těla. Pro celou výšku `W=1`, pro střed `W=4u(1−u)`, u krčku `W=smoothstep(1−u)`. Všechny váhy zůstávají v [0,1]. Jejich meze `|W'|, |W''|` podle u jsou postupně (0,0), (4,8), (1,5;6).

Twist je `twistDeg * T(u)`: původní plynulý `T=smoothstep(u)`, rovnoměrný `T=u` a tam/zpět `T=4u(1−u)`. Meze derivací podle u jsou (1,5;6), (1;0), (4;8). U tam/zpět je zadaný úhel maximální otočení v polovině těla, na konci je otočení nula. Při nenulové amplitudě se pro středovou obálku a obrácený twist explicitně vzorkuje polovina těla. Při nulové amplitudě volba průběhů bitově nemění síť.

Schéma JSON zůstává ve verzi 1: chybějící `amplitudeProfile` a `twistProfile` se doplní jako `uniform` a `smooth`. Neznámé hodnoty či klíče se dál odmítají. Starší uložené nastavení zachová tvar. Nové volby se ukládají v JSON i místním úložišti a vstupují do worker hashů.

Povrch je dále rozšířený o tvar a pootočení žeber a nezávislé vodorovné vlny:

```text
r(θ,z) = r0(z) + Ar * E(z) * w(v) + Aw * B(z) * sin(f(z−n) + δ)
v = k * (θ − twist(z) − rotation)
w(v) = cos(v) + c * (cos²(v) − 1)
f = 2π * waveCount / H; δ = 2π * waveShiftPercent / 100
```

Koeficient `c` je 0 pro oblá žebra, +0,45 pro úzké vrcholy a −0,45 pro široké vrcholy. Remapování kosinu je monotónní v [-1,1] (`1+2c*cos(v) >= 0,1`), takže zachová stejné minimum/maximum ±1. Nevytváří ostré zlomy. Derivace podle fáze jsou `w'=-sin(v)−c*sin(2v)` a `w''=-cos(v)−2c*cos(2v)`; jejich bezpečné meze jsou `a1=1+|c|`, `a2=1+2|c|`. Analýza lokální křivosti používá tyto skutečné derivace.

Vodorovné vlny mají hloubku 0–2 mm, 1–12 period po výšce těla a posun 0–100 % jedné periody. Fungují i při nulové amplitudě žeber; průřezy tehdy zůstávají kruhové. Ochranná obálka `B` zajišťuje nulovou deformaci i první derivaci na krčku a zakončení. Čtvrtiny period včetně posunu se přidávají mezi kritické výšky triangulace i analýzy. Posun 100 % a otočení 360° se normalizují na nulu. Staré JSON dostávají `ribShape=rounded`, `ribRotationDeg=0`, `waveAmplitudeMm=0`, `waveCount=4`, `waveShiftPercent=0`.

## Uzavřenost a samoprůniky

Každý vodorovný prstenec má kladný poloměr, stejné úhlové vzorky v rostoucím pořadí a společný střed. Z roste striktně. Poslední úhlový segment navazuje modulo počtu vrcholů, takže šev nemá duplicitní vrcholy. Dva trojúhelníky na buňku mají vnější orientaci. Při kladném poloměru zakončení vějíře s jediným středovým vrcholem uzavírají oba konce. Při nulovém poloměru se koncový prstenec ani disk nevytváří: poslední kladný prstenec se spojí s jediným společným vrcholem na ose. Tento vějíř patří k plášti a má šikmé normály, nikoli normály plochého víčka.

Poloměr zakončení v UI i schématu dovoluje 0–3 mm (krok ovladače 0,1 mm). Nulový poloměr používá stabilní vyhodnocení horního profilu od vrcholu: `r0=R*((1-w)*f(v)+w*v*(2-v))`, `v=(1-u)/(1-peak)`, `w=0.1`. Zachová původní rodinu siluety a nulový sklon u maxima, u vrcholu má konečný kuželový sklon. Vyhne se odčítání téměř stejných poloměrů i sevřenému hrotu s nulovým sklonem. Původní kladná zakončení se nemění.

Pro špičku je povolený kontakt s osou pouze v posledním bodě. V koncovém intervalu délky `d<=min(b,L)` platí `r0 >= w*R*d/L` a absolutní deformace nejvýše `3*(Ar+Aw)*d²/b²`. Striktní nerovnost těchto koeficientů certifikuje celý otevřený interval až k vrcholu; jinde zůstává intervalová kontrola kladnosti. Globální i lokální meze derivací připočítávají příspěvek kuželového přechodu, takže platí i původní mez interpolace.

Vrcholové trojúhelníky se kontrolují ve skutečných float32 souřadnicích před vytvořením sítě. Numericky příliš blízký poslední prstenec lze vynechat pouze pokud sloučený poslední interval zůstane v cílové toleranci podle lokální meze; jinak se vrátí explicitní chyba přesnosti. Vzorky pak mají jeden vrchol na nejvyšším Z, žádné nulové trojúhelníky a Eulerovu charakteristiku 2. Analýza 1.4.0 umí koncový bod a výslovně odlišuje špičku STL od uzavření skutečné vase dráhy.

Kladnost radiální obálky se ověřuje analytickou intervalovou mezí `min(r0) - (Ar + Aw) * max(B) > 1e-6 mm`. Jde o konzervativní mez celkového účinku žeber i vln, protože `|w|<=1`, `|sin|<=1` a `0<=W<=1`. Intervaly se dělí v maximu profilu a hranicích náběhu/doběhu. Na každém takovém intervalu je základní profil monotónní, náběh monotónně roste a doběh monotónně klesá. Pokud konzervativní mez nestačí, interval se rekurzivně rozpůlí; po 16 úrovních se nejistý vstup odmítne. Vzorkování sítě tím nemůže skrýt záporný poloměr. Při odmítnutí UI označí obě aktivní hloubky a otevře jejich sekce.

Každý trojúhelník pláště zůstává v příslušném konvexním úhlovém sektoru (mezera menší než π) a mezi dvěma sousedními výškami. Oddělené sektory nebo výškové intervaly se nemohou objemově překřížit. Sousední buňky mají sdílené vrcholy a hrany. To je záruka konstrukce této omezené rodiny, nikoli obecný test libovolného CAD modelu.

`validateMesh` samostatně kontroluje konečnost, indexy, délky polí, degenerace, duplicitní plochy, dvě incidentní plochy na hranu, opačné směry sdílených hran, souvislost, nepoužité vrcholy, Eulerovu charakteristiku 2 a kladný podepsaný objem. Obecné průniky importovaných sítí tento validátor necertifikuje. Testy navíc používají nezávislou kontrolu neincidentních trojúhelníků se prostorovým BVH a oddělujícími osami, včetně koplanárních případů. Ověřují skutečné exportní sítě všech presetů a široké fixture i uměle se protínající trojúhelníky.

## Odchylka triangulace

Přesné výšky zahrnují podstavu, konec krčku, maximum, konce obálek a zakončení. Úhlových segmentů je alespoň 128 pro náhled a 256 pro export, současně alespoň 16 na periodu žebra. Počet se zvyšuje podle druhé derivace povrchu, nikoli pouze počtu žeber.

Pro parametrický povrch `P(θ,z)` a trojúhelník v parametrické buňce o rozměrech `Δθ, Δz` používáme horní mez:

```text
error <= Mθθ * Δθ² / 8 + Mθz * Δθ * Δz / 4 + Mzz * Δz² / 8
```

`M` jsou horní meze norem příslušných druhých derivací v celém intervalu. Odvození: rozvoj v bodě uvnitř trojúhelníku, vážený barycentrickými souřadnicemi vrcholů, ruší členy prvního řádu. Vážený rozptyl každé souřadnice je nejvýše čtvrtina čtverce jejího rozsahu. Smíšený člen je omezen Cauchyho–Schwarzovou nerovností. Mez tedy platí i na hranách a uvnitř trojúhelníků, nikoli jen v generovaných vrcholech.

Na hladkém úseku délky `L` se změnou poloměru `D` jsou `|r0'| <= c1 D/L` a `|r0''| <= c2 D/L²`, kde faktory odpovídají profilu v tabulce. Pro jediné aktivní rameno původní obálky délky `b` jsou `B1 = 1.5/b`, `B2 = 6/b²`; mimo ramena jsou obě meze nula. Náběh a doběh se díky `2b <= H` nepřekrývají uvnitř intervalu. Pro `E=B*W` platí `E1 <= B1+w1/H` a `E2 <= B2+2B1*w1/H+w2/H²`. Fáze žeber má meze `q1 = k |twist| t1/H` a `q2 = k |twist| t2/H²`. Vlny přidávají meze `D1=Aw*(B1+f)` a `D2=Aw*(B2+2B1*f+f²)`. Meze i kritické výšky jsou společné pro triangulaci a mezivrstvovou analýzu 1.2.0 v `surfaceBounds.ts`.

```text
Mθθ <= R + Aw + Ar (1 + 2k*a1 + k²*a2)
Mθz <= |r0'| + D1 + Ar (E1*(1+k*a1) + q1*(a1+k*a2))
Mzz <= |r0''| + D2 + Ar (E2 + 2E1*q1*a1 + q2*a1 + q1²*a2)
```

Nesplnění meze půlí interval Z. Limit je 2 000 000 trojúhelníků pro STL (binární soubor nejvýše 100 000 084 bajtů) a nově 1 200 000 pro náhled. Překročení vrací `RESOURCE_LIMIT` s doporučením hrubšího STL, bez automatického zhoršení přesnosti; odmítnutí probíhá už při plánování výšek před alokací sítě. Část kombinací z rozsahů proto může být nadále odmítnuta. Pro float32 je rezervováno dalších 0,0001 mm uvnitř každé cílové tolerance. Pro maximální souřadnici 156 mm je velikost kvantizačního posunu menší než 0,000014 mm.

Pro husté náhledy nad původních 600 000 ploch a exporty překračující limit se před odmítnutím zkouší lokální meze (`localBounds.ts`) a několik počtů úhlových segmentů. Zůstává minimálně 128/256 segmentů a 16 na periodu žebra; úhlový člen se plánuje nejvýše do třetiny interpolačního rozpočtu. Každý kandidát projde celým dělením Z se stejnou tolerancí, vybere se nejmenší přípustná síť. Do té doby se nealokují souřadnice ani indexy. Menší existující sítě zůstávají bitově shodné.

Lokální meze vycházejí z uzavřeného intervalu děleného v původních uzlech. Základní profil je na něm monotónní, jeho maximální poloměr leží na konci intervalu. Derivace kubického a kosinového profilu se omezují jejich skutečnými krajními hodnotami a případným vnitřním maximem. Rovný střed diamantu má nulovou druhou derivaci. Pro součin obálky `E=B*W` jsou nové meze `E0=B0*W0`, `E1=B1*W0+B0*W1`, `E2=B2*W0+2B1*W1+B0*W2`. Členy nesoucí amplitudu fáze se násobí `E0`; obdobně členy sinusových vln nesou skutečnou horní mez `B0`. První a druhá derivace twistu používá maxima na daném intervalu. Zůstává stejná Taylorova mez v celé buňce i rezervace pro float32. `sampling.strategy` rozlišuje původní a lokální plán.

Analýza 1.3.0 používá stejnou lokální mez druhé derivace pro počet mezivrstvových vzorků každé vrstvy; interval se nejprve rozdělí ve všech kritických výškách. Nemusí tak celé tělo vzorkovat podle nejprudšího ramene. Tolerance obrysů 0,005 mm a limit 32 mezivzorků na vrstvu zůstávají zachovány, rozpočet porovnání obrysů se zvyšuje ze 3 na 12 milionů. Hranice rozpočtu stále znamená explicitní nedokončenou analýzu, nikoli potvrzení nízkého rizika.

Topologická kontrola nyní používá seřazené směrované hrany ve `Float64Array`, union-find a tabulku ploch v typovaných polích s porovnáním celých trojic při kolizích. Nevytváří objekt pro každou hranu ani řetězec pro každou plochu; zachovává kontroly duplicit, manifold hran a orientace. Pro nejvýše přibližně milion vrcholů jsou celočíselné klíče hran přesně reprezentovatelné.

Automatický test porovnává interpolaci obou trojúhelníků s přímým vyhodnocením povrchu na úhlových a výškových průřezech, vnitřních bodech, obvodových hranách i diagonálách kombinovaného modelu. Pro nulovou amplitudu žeber twist ani tvar/pootočení žeber bitově nemění síť; při nulové hloubce vln počet a posun vln síť také nemění.

## Tolerance a STL

Topologická numerika používá měřítko `s = max(1 mm, rozměry bbox)`. Plošná tolerance je `s² * 1e-12`, objemová `s³ * 1e-12`. Jsou podstatně menší než nejmenší konstrukční prvky z podporovaných mezí. Indexy kanonické sítě se nikdy nesvařují podle vzdálenosti.

Encoder před zápisem převede souřadnice přes `Math.fround`, znovu validuje geometrii a ověří změnu každého extrému bbox do 0,001 mm. Výstup obsahuje jen tělo, normály ploch, mm souřadnice a nulové atributy. Nezávislý parser v testech a skriptech svařuje přesně stejné float32 souřadnice; nezávisí na indexech generátoru. Porovnává se uzavřenost, objem a bbox po round-tripu.

Worker vytváří nová pole pro každou úlohu a předává jejich vlastnictví UI. Starší odpověď je identifikována request ID, revizí, druhem úlohy a hashem vstupů. Změna presetu ukončí předchozí worker, takže se nebuduje fronta synchronních úloh. Export používá zamrazenou kopii parametrů, tiskových předpokladů i detailu STL a samostatný worker; název souboru vzniká z této kopie. Detail je součástí exportního hashe; nemění náhledový hash ani nastavení modelu v JSON. V UI platí pro příští export a při obnovení stránky se vrátí na standardní hodnotu. Ověřený export lze spustit i při selhání náhledu; validitu znovu rozhodne exportní worker.
