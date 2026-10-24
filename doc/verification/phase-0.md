# Fáze 0 — geometrie, STL a první slicing

Datum: 24. 10. 2026. Generátor: 0.1.0. Repozitář při ověření dosud neměl první commit; identitu výstupů určují verze generátoru, vstupní hash a SHA-256 STL v `fixtures/manifest.json`. Původní implementační plán nebyl změněn.

**Stav: implementováno a automaticky ověřeno; slicing a rozbor G-code provedeny, vizuální kontrola GUI a fyzický tisk neprovedeny. Brána fáze 0 zůstává částečně otevřená.**

## Referenční podklady

| Případ | JSON / STL | Rozměry STL v mm | Trojúhelníky | Vstupní hash |
| --- | --- | --- | --- | --- |
| S01 | `fixtures/S01-elongated-smooth.{json,stl}` | 56 × 56 × 96 | 39 936 | `7ccd5cb9` |
| S02 | `fixtures/S02-short-wide-risk.{json,stl}` | 90 × 90 × 43 | 41 984 | `a319224c` |

Obě těla mají krček Ø 14 × 8 mm, zakončení Ø 2,4 mm, nulovou amplitudu i twist. S01 má tělo vysoké 88 mm, S02 35 mm. S02 je samostatná záměrně riziková fixture; běžný zaoblený preset zůstává 56 × 60 mm bez krčku.

Kanonická síť i STL načtený nezávislým parserem mají jednu uzavřenou komponentu, dvě plochy na každé hraně, opačné směry sdílených hran, Eulerovu charakteristiku 2 a kladný objem. Nezávislý test neincidentních trojúhelníků nezjistil průniky. PrusaSlicer `--info` potvrdil `manifold = yes`, `number_of_parts = 1` a očekávané rozměry. Žádná oprava sítě nebyla v konzolovém průchodu vyžádána ani hlášena. Originální výpisy: `S01-info.log`, `S02-info.log`.

Horní meze odchylky triangulace jsou 0,04344 mm (S01) a 0,04806 mm (S02), pod cílem 0,05 mm včetně rezervy na float32. Objem po STL round-tripu: přibližně 92 461,780 mm³ a 90 147,041 mm³. Hodnoty objemu z PrusaSliceru se nepatrně liší jeho numerickým výpočtem; nemění se rozměry ani počet komponent.

## Slicer a konfigurace

PrusaSlicer **2.9.6**, Windows, `C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe`. Použit uložený `phase-0-slicer.ini`, tedy obecný diagnostický profil pro podložku 200 × 200 mm a trysku 0,4 mm. Konkrétní tiskárna není zvolená. Předpoklady materiálu: filament 1,75 mm, 210 °C, podložka 60 °C; nejsou ověřeným výrobním profilem.

Vrstva i první vrstva 0,20 mm, šířka vnějšího perimetru 0,45 mm, tři spodní vrstvy a nulová minimální tloušťka dna, jeden perimetr, nulová výplň, nulové horní vrstvy, zapnutý spiral vase, bez podpěr, raftu, skirtu a brimu. Start/end G-code je obecný diagnostický. Zkoumané soubory neslouží k přímému tisku na neznámé tiskárně. Skutečná rozvinutá konfigurace vzniká v `.scratch/resolved-profile.ini`.

Reprodukce z kořene projektu:

```powershell
npm ci --ignore-scripts
.\scripts\verify-slicer.ps1
# Případně jiná cesta:
.\scripts\verify-slicer.ps1 -Slicer 'D:\aplikace\PrusaSlicer\prusa-slicer-console.exe'
```

Skript znovu vytvoří STL/JSON, načte je pomocí `--info`, provede `--load phase-0-slicer.ini --export-gcode`, uloží logy a zavolá `scripts/inspect-gcode.ts`. G-code zůstává v ignorovaném `.scratch/`; jeho SHA-256 v reportu zahrnuje časový údaj v hlavičce, takže se při novém slicingu mění. STL a vstupní hash jsou deterministické.

## Skutečná pozorování z G-code

| Vlastnost | S01 | S02 |
| --- | --- | --- |
| Poslední výška výplně dna | 0,60 mm | 0,60 mm |
| Vrstvy se spirálovým růstem Z | 477 | 212 |
| Klesající extruzní segmenty nad dnem | 0 | 0 |
| Přerušující XY přejezdy během spirály | 0 | 0 |
| Otáčky jednotlivých spirálových vrstev | 0,99929–1,00057 | 0,99875–1,00137 |
| Poslední extruzní výška | 96,00 mm | 43,00 mm |
| Koncový téměř plný plochý obvod | 0,96871 otáčky | 0,96874 otáčky |
| Odhad otvoru z poslední dráhy | 1,50 mm | 1,53 mm |

První skutečná extruze je na Z = 0,20 mm, na modelu podstavy Z = 0. Její obal je v obou případech XY 93,235–106,765 mm při centrování na 100,100. Odpovídá krčku Ø 14 mm po započtení šířky extruze; nevzniká samostatný ostrov těla. Dno končí hluboko uvnitř přímého 8mm krčku. V nadložních vrstvách není infill ani druhá vnitřní stěna. Rozbor prověřil lineární XY dráhy, počet otáček, růst Z a nepřítomnost přerušujících přejezdů; nejde o pouhé potvrzení nastavené volby `spiral_vase`.

Po dosažení finálního Z přidává PrusaSlicer ještě téměř jednu plochou otáčku s postupným poklesem extruze na nulu. Poslední nulový extruzní pohyb podél obvodu je v reportu uveden zvlášť; není klasifikován jako přerušení spirály. **Horní disk solid STL se netiskne jako víčko.** Odhad vnitřního otvoru vychází z nejmenší vzdálenosti středu od úseček posledního obvodu, minus šířka extruze. Skutečný otvor výtisku zůstává nezměřený.

Úplný strojový záznam: `phase-0-gcode-report.json`; výstup sliceru: `S01-slicer.log`, `S02-slicer.log`.

## Rameno, rizika a závěr brány

Analytický maximální sklon hladkého rozšiřujícího ramene je pro S01 **35,60° od svislice**; radiální změna při vrstvě 0,2 mm dosahuje 0,1432 mm. Pro S02 je to **72,93°** a 0,6514 mm, tedy více než předpokládaná extruzní šířka 0,45 mm. Jde o dílčí hladký analytický odhad z fáze 0; úplná analýza sousedních obrysů a mapa rizik ještě nejsou implementovány.

PrusaSlicer u S01 skutečně hlásil **Low bed adhesion**. U S02 hlásil **Collapsing overhang, Low bed adhesion, Loose extrusions**. Tyto zprávy jsou zachované v logu. Doporučení podpěr z obecného varování sliceru nebylo automaticky aplikováno do vase profilu. Adhezi lze v dalším testu ověřit s brimem; široké rameno potřebuje delší tělo/přechod, případně jinou kombinaci rozměrů. Samotné úspěšné vytvoření G-code není důkaz fyzické tisknutelnosti S02.

Výchozí protáhlý profil nebyl na základě tohoto testu změněn. CLI dráha podporuje pokračování nezávislé implementace fáze 1. Zakončení je nutné v produktu popisovat jako potenciálně otevřené. Obecný diagnostický profil ani malý koncový otvor neopravňují tvrzení, že byl dokončen nebo ověřen skutečný výtisk.

## Zbývající vizuální a fyzické ověření

GUI Prusa G-code viewer se automatizaci nepodařilo získat jako cílovatelné okno. Vizuální prohlídka ani snímky **nejsou doložené**; konzolový slicing a rozbor souboru tím nejsou nahrazeny vizuálním ověřením. Fyzický tisk neproběhl a parametry skutečné tiskárny nejsou zadány.

- [x] Dva reprodukovatelné solid STL/JSON a geometrické výsledky s hashi.
- [x] Krček na podložce, jedna komponenta, kladný objem a očekávané mm rozměry.
- [x] Načtení a slicing PrusaSlicerem bez hlášené opravy sítě.
- [x] Nad třemi spodními vrstvami doložen jediný spirálový obvod rozborem G-code.
- [x] Popsán koncový obvod a nezacelený otvor v diagnostické dráze.
- [x] Rizikový široký profil odlišen analyticky i skutečnými varováními sliceru.
- [ ] Otevřít `.scratch/S01.gcode` a `.scratch/S02.gcode` v PrusaSlicer G-code vieweru, zaznamenat profil a snímky prvních tří vrstev, náběhu spirály, ramene a posledních obvodů.
- [ ] V GUI zkontrolovat, že legenda typů extruze a vrstvení odpovídá rozboru; obzvlášť poslední plochý doběh.
- [ ] Uložit projekt s konkrétní tiskárnou a profilem; před skutečným tiskem znovu ověřit reálnou výšku dna, šířku extruze a koncový otvor.
- [ ] Fyzický výtisk a měření otvoru, adheze, ramene a krčku.
