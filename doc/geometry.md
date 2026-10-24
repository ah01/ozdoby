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

## Uzavřenost a samoprůniky

Každý vodorovný prstenec má kladný poloměr, stejné úhlové vzorky v rostoucím pořadí a společný střed. Z roste striktně. Poslední úhlový segment navazuje modulo počtu vrcholů, takže šev nemá duplicitní vrcholy. Dva trojúhelníky na buňku mají vnější orientaci. Vějíře s jediným středovým vrcholem uzavírají oba konce; poloměr špičky je nenulový.

Kladnost radiální obálky se ověřuje analytickou intervalovou mezí `min(r0) - A * max(E) > 1e-6 mm`. Intervaly se dělí v maximu profilu a hranicích náběhu/doběhu. Na každém takovém intervalu je základní profil monotónní, náběh monotónně roste a doběh monotónně klesá. Pokud konzervativní mez nestačí, interval se rekurzivně rozpůlí; po 16 úrovních se nejistý vstup odmítne. Vzorkování sítě tím nemůže skrýt záporný poloměr.

Každý trojúhelník pláště zůstává v příslušném konvexním úhlovém sektoru (mezera menší než π) a mezi dvěma sousedními výškami. Oddělené sektory nebo výškové intervaly se nemohou objemově překřížit. Sousední buňky mají sdílené vrcholy a hrany. To je záruka konstrukce této omezené rodiny, nikoli obecný test libovolného CAD modelu.

`validateMesh` samostatně kontroluje konečnost, indexy, délky polí, degenerace, duplicitní plochy, dvě incidentní plochy na hranu, opačné směry sdílených hran, souvislost, nepoužité vrcholy, Eulerovu charakteristiku 2 a kladný podepsaný objem. Obecné průniky importovaných sítí tento validátor necertifikuje. Testy navíc používají nezávislou kontrolu neincidentních trojúhelníků se prostorovým BVH a oddělujícími osami, včetně koplanárních případů. Ověřují skutečné exportní sítě všech presetů a široké fixture i uměle se protínající trojúhelníky.

## Odchylka triangulace

Přesné výšky zahrnují podstavu, konec krčku, maximum, konce obálek a zakončení. Úhlových segmentů je alespoň 128 pro náhled a 256 pro export, současně alespoň 16 na periodu žebra. Počet se zvyšuje podle druhé derivace povrchu, nikoli pouze počtu žeber.

Pro parametrický povrch `P(θ,z)` a trojúhelník v parametrické buňce o rozměrech `Δθ, Δz` používáme horní mez:

```text
error <= Mθθ * Δθ² / 8 + Mθz * Δθ * Δz / 4 + Mzz * Δz² / 8
```

`M` jsou horní meze norem příslušných druhých derivací v celém intervalu. Odvození: rozvoj v bodě uvnitř trojúhelníku, vážený barycentrickými souřadnicemi vrcholů, ruší členy prvního řádu. Vážený rozptyl každé souřadnice je nejvýše čtvrtina čtverce jejího rozsahu. Smíšený člen je omezen Cauchyho–Schwarzovou nerovností. Mez tedy platí i na hranách a uvnitř trojúhelníků, nikoli jen v generovaných vrcholech.

Na hladkém úseku délky `L` se změnou poloměru `D` jsou `|r0'| <= c1 D/L` a `|r0''| <= c2 D/L²`, kde faktory odpovídají profilu v tabulce. Pro jediné aktivní rameno původní obálky délky `b` jsou `|B'| <= 1.5/b`, `|B''| <= 6/b²`; mimo ramena jsou obě meze nula. Náběh a doběh se díky `2b <= H` nepřekrývají uvnitř intervalu. Pro `E=B*W` platí `|E'| <= |B'|+w1/H` a `|E''| <= |B''|+2|B'|w1/H+w2/H²`. Fáze žeber má meze `q1 = k |twist| t1/H` a `q2 = k |twist| t2/H²`. Meze i kritické výšky jsou společné pro triangulaci a mezivrstvovou analýzu 1.1.0 v `surfaceBounds.ts`.

```text
Mθθ <= R + A (k+1)²
Mθz <= |r0'| + A (k+1) (|E'| + q1)
Mzz <= |r0''| + A (|E''| + 2 |E'| q1 + q2 + q1²)
```

Nesplnění meze půlí interval Z. Na přání uživatele je původní limit 300 000 zvýšen na 2 000 000 trojúhelníků pro STL (binární soubor nejvýše 100 000 084 bajtů) a 600 000 pro náhled. Překročení vrací `RESOURCE_LIMIT` s doporučením hrubšího STL, bez automatického zhoršení přesnosti; odmítnutí probíhá už při plánování výšek před alokací sítě. Část kombinací z rozsahů proto může být nadále odmítnuta. Pro float32 je rezervováno dalších 0,0001 mm uvnitř každé cílové tolerance. Pro maximální souřadnici 156 mm je velikost kvantizačního posunu menší než 0,000014 mm.

Topologická kontrola nyní používá seřazené směrované hrany ve `Float64Array`, union-find a tabulku ploch v typovaných polích s porovnáním celých trojic při kolizích. Nevytváří objekt pro každou hranu ani řetězec pro každou plochu; zachovává kontroly duplicit, manifold hran a orientace. Pro nejvýše přibližně milion vrcholů jsou celočíselné klíče hran přesně reprezentovatelné.

Automatický test porovnává interpolaci obou trojúhelníků s přímým vyhodnocením povrchu na úhlových a výškových průřezech, vnitřních bodech, obvodových hranách i diagonálách žebrovaného zkrouceného modelu. Pro nulovou amplitudu se fáze vůbec nevyhodnocuje; twist tedy bitově nemění síť.

## Tolerance a STL

Topologická numerika používá měřítko `s = max(1 mm, rozměry bbox)`. Plošná tolerance je `s² * 1e-12`, objemová `s³ * 1e-12`. Jsou podstatně menší než nejmenší konstrukční prvky z podporovaných mezí. Indexy kanonické sítě se nikdy nesvařují podle vzdálenosti.

Encoder před zápisem převede souřadnice přes `Math.fround`, znovu validuje geometrii a ověří změnu každého extrému bbox do 0,001 mm. Výstup obsahuje jen tělo, normály ploch, mm souřadnice a nulové atributy. Nezávislý parser v testech a skriptech svařuje přesně stejné float32 souřadnice; nezávisí na indexech generátoru. Porovnává se uzavřenost, objem a bbox po round-tripu.

Worker vytváří nová pole pro každou úlohu a předává jejich vlastnictví UI. Starší odpověď je identifikována request ID, revizí, druhem úlohy a hashem vstupů. Změna presetu ukončí předchozí worker, takže se nebuduje fronta synchronních úloh. Export používá zamrazenou kopii parametrů, tiskových předpokladů i detailu STL a samostatný worker; název souboru vzniká z této kopie. Detail je součástí exportního hashe; nemění náhledový hash ani nastavení modelu v JSON. V UI platí pro příští export a při obnovení stránky se vrátí na standardní hodnotu. Ověřený export lze spustit i při selhání náhledu; validitu znovu rozhodne exportní worker.
