# Krček 5 mm, kombinované povrchy a přímý přístup k mapě

Průměr krčku má ve schématu i editoru rozsah 5–24 mm. Přepínač mapy rizik je v hlavním panelu nad modelem, dostupný i na mobilu bez otevření analytického popoveru. Při neaktuální či selhané analýze se zobrazí čekání nebo nedostupnost; staré barvy se nepoužívají.

Kombinace žeber, vln a vratného twistu narazila na původní limit 600 000 ploch náhledu i 3 milionů porovnání analýzy. Náhled nyní dovoluje 1,2 milionu ploch. Husté sítě se před odmítnutím plánují podle lokálních derivací a několika úhlových rozlišení. Analýza 1.3.0 přizpůsobuje mezivrstvové vzorkování lokálnímu zakřivení a má 12milionový rozpočet. Přesnost 0,2 mm pro náhled ani zvolená přesnost STL se automaticky nesnižuje. Exportní limit 2 milionů ploch zůstává explicitní; extrémní jemné STL může stále potřebovat hrubší volbu.

Reprodukce: `node --expose-gc --import tsx scripts/verify-geometry-limits.ts`. Úplné vstupy a jednotlivá měření jsou v `geometry-limits.json`. Případ používá tělo 100 × 140 mm, R3 zakončení, 24 úzkých žeber hloubky 3 mm, 8 vln hloubky 1 mm, náběh 20 mm a vratný twist 180°.

| Výstup | Trojúhelníky | Tolerance | Výsledek |
| --- | --- | --- | --- |
| Náhled včetně renderovacích bufferů | 761 616 | 0,2 mm | Validní, lokální plán |
| Hrubší STL | 1 018 240 | 0,15 mm | Validní float32, 50 912 084 B |
| Finální analýza | — | Obrysy 0,005 mm | Dokončena, 7 892 352 porovnání |

Jde o jednotlivé běhy Node včetně validace a přípravy bufferů, nikoli zahřáté p95 ani měření paměti prohlížeče. Původní referenční hladká STL zůstávají shodná; manifest nově uvádí strategii plánování.

Automatické testy ověřují skutečný float32 STL s 5mm krčkem a odmítnutí menšího průměru, hustý náhled v limitu, odchylku uvnitř obou trojúhelníků buněk a dokončenou analýzu nad starým rozpočtem. Dalších 18 kombinací používá nezávislé numerické kontroly globálních i lokálních druhých/míšených derivací. Samostatný test simulovaného selhání analýzy potvrzuje zachování validního STL.

Playwright kontroluje 5mm krček a stažení STL na mobilu, mapu bez popoveru i stav selhané analýzy. Zátěžový případ se skutečným WebGL náhledem a aktuální mapou projde také s 5mm krčkem. Snímky: `risk-map-mobile.jpg`, `dense-risk-map.jpg`. Slicerové ani fyzické ověření těchto nových variant není tímto doplněno.
