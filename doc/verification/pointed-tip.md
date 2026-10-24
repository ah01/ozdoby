# Zakončení do nulového poloměru

Pole a slider „Poloměr zakončení“ mají rozsah 0–3 mm, krok 0,1 mm. Ověřeny jsou také zadané hodnoty 0,01 mm. Nula znamená jediný sdílený vrchol v celkové výšce, nikoli prstenec s duplicitními souřadnicemi či nulový disk. Poslední vějíř patří plášti. Kladné poloměry používají původní konstrukci beze změny.

Nulový profil má konečný kuželový sklon u vrcholu a nulový sklon u maxima. Přechod je vyhodnocený stabilně od špičky. Analytická mez certifikuje kladný poloměr ve všech nižších průřezech, povolený bod na ose je pouze poslední vrchol. Poslední prstenec, který by ve float32 vytvářel zanedbatelnou plochu, se odstraní jen po ověření sloučené interpolační meze. Přesnost exportu se nezhoršuje. Vzorce jsou v `../geometry.md`.

Ověření zahrnuje všech pět presetů s nulovým, 0,01mm a 0,1mm zakončením, skutečný float32 STL round-trip, rozměry, Eulerovu charakteristiku 2, jeden nejvyšší vrchol a chybějící disk u nuly. Dalších pět testů kontroluje odchylku uvnitř trojúhelníků až k vrcholu při současných žebrech, vlnách a twistu. Nezávislý BVH test kontroluje celý transformovaný diamant se špičkou. Dále je ověřený téměř souběžný koncový vzorek vlny, jednotkové renderovací normály, bodový obrys v analýze a odmítnutí průchodu deformace přes osu.

Browserové scénáře na desktopu a mobilu nastaví 0,1 mm, posuvníkem přejdou na nulu, ověří aktuální náhled/mapu, stáhnou JSON a STL, nezávisle zkontrolují jeden vrchol a validitu a obnoví nulu po reloadu. Analytická zpráva 1.4.0 vysvětluje, že vase dráha může skončit před matematickým vrcholem. Snímky: `pointed-desktop.jpg`, `pointed-mobile.jpg`.

Skutečné uzavření špičky výtisku nebylo fyzicky ověřeno. Žádný automatický report je neslibuje; kontrola posledních drah ve sliceru zůstává nutná.
