# Kapacita a volitelný detail STL

Původní limit 300 000 trojúhelníků blokoval i běžné žebrované kombinace. Export nyní dovoluje 2 000 000 trojúhelníků, náhled 600 000. Tlačítko „Detail“ ve spodní liště nabízí explicitní přesnosti 0,15 / 0,05 / 0,02 mm; výchozí zůstává 0,05 mm. Překročení limitu nikdy potichu nepřepne na horší kvalitu.

Opakovatelný kapacitní průchod: `node --expose-gc --import tsx scripts/verify-stl-detail.ts`. Úplné vstupy a měření jsou v `stl-detail-capacity.json`. Každý případ zahrnuje výpočet sítě, topologickou kontrolu, validaci float32, zápis STL a pokus o finální tiskovou analýzu. Jde o jednotlivé běhy Node na tomto počítači, nikoli zahřáté p95 ani měření paměti prohlížeče.

| Případ | Přesnost | Trojúhelníky | Velikost STL |
| --- | --- | --- | --- |
| Tělo 50 × 101 mm, 17 žeber, amplituda 1,8 mm, twist 120° | 0,15 mm | 88 128 | 4 406 484 B |
| Stejný tvar | 0,05 mm | 350 336 | 17 516 884 B |
| Stejný tvar | 0,02 mm | 770 304 | 38 515 284 B |
| Tělo 100 × 140 mm, špička R3, 24 žeber, amplituda 3 mm, twist 180°, náběh 20 mm | 0,05 mm | 1 969 152 | 98 457 684 B |

Všechny čtyři STL prošly topologií i kontrolou skutečných float32 souřadnic. První tři dokončily analýzu. Poslední případ překročil samostatný analytický rozpočet; export proto vrací platné STL s výslovným stavem nedokončené analýzy. Kumulativní maximum RSS celého kapacitního procesu bylo přibližně 416 MiB, poslední výpočet trval přibližně 5,6 s. Prohlížeč a slabší zařízení mohou potřebovat jiný čas i paměť.

Automatické kontroly zahrnují vzorky uvnitř obou trojúhelníků každé testované buňky pro všechny tři přesnosti, float32 STL round-trip tvaru nad starým limitem, explicitní odmítnutí nad novým limitem a hrubší export stejného extrému. Worker protokol ověřuje detail v hashi. Playwright kontroluje skutečná stažení hrubého a jemného STL, nezměněnou revizi náhledu a změnu volby během exportu proti zamrazenému zadání. Slicerová ani fyzická akceptace celé matice tím není doplněna.
