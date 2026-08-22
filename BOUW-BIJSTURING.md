# Bouwverslag — bijsturing en hardloopopbouw

Branch `bijsturing-en-hardloopopbouw`, vanaf `main`. Vier commits, elk met een groene
suite en een werkende productiebuild. Niet gepusht.

| Commit | Onderdeel |
| --- | --- |
| `864631e` | 1 — unilaterale oefeningen |
| `10614f0` | 3 — navigatie binnen een sessie |
| `5e5bbd1` | 4 en 5 — hardloopafstand en het meebewegende weekplafond |
| `05e7c10` | 2 — extra oefening bij een te makkelijke sessie |

Onderdeel 6 staat bewust buiten dit repo, in `~/trainingsreview` op de Pi.

**Eindstand:** 914 tests in 41 bestanden, alles groen. `npm run build` (typecheck +
productiebuild + service worker) draait door. `SCHEMA_VERSION` staat op **14**.

De volgorde is niet die van de opdracht: 3 ging vóór 2 omdat beide het sessiescherm
raken en de navigatie het fundament is waar het aanbod van een extra oefening op landt,
en 4 en 5 zijn samen gedaan omdat ze allebei aan hetzelfde weekplafond rekenen.

---

## 1. Unilaterale oefeningen

De conventie in `dumbbell.ts` zei "gewicht per dumbbell, reps per zijde" over de hele
bibliotheek. Punt twee klopte alleen voor eenarmig werk: bij bankdrukken met twee
dumbbells is een rep gewoon een rep, en "per zijde" halveerde daar het werk op papier.

`perSide?: boolean` is `unilateral: boolean` geworden — **verplicht** en expliciet op
alle 94 oefeningen. Dat was de belangrijkste keuze hier: door de vlag verplicht te maken
in plaats van optioneel compileert een nieuwe oefening zonder vlag niet, in plaats van
stilzwijgend als tweezijdig door te gaan. Precies die stilte was de bug.

Label en uitleg volgen de vlag:

- tweearmig: `REPS`, geen "per zijde"-tekst, geen extra uitlegregel;
- eenarmig: `REPS PER ZIJDE` plus de regel *"Per kant tellen: 10 links en 10 rechts is
  10 reps, niet 20."* (`repsHint` in `load.ts`, getoond onder het repveld);
- de helperregel over het gewicht van één dumbbell staat er ongewijzigd — die ging over
  het gewicht, en daar was niets mis mee.

Twintig oefeningen staan op `true`. De vlag zit op de oefening en niet op het materiaal,
want eenbenige leg press en side plank zijn ook per kant zonder dat er een dumbbell aan
te pas komt. `sideFactor` en de duurschatting lezen nu dezelfde vlag, dus volume,
tijdschatting en label kunnen niet meer uit elkaar lopen.

Testdekking: `unilateraal.test.ts` — de vlag is overal een echte boolean, de lijst
`true`-oefeningen ligt vast, alles wat zichzelf "eenbenig" of "eenarmig" noemt staat
erop, en de labels, de uitleg en het rekenwerk volgen.

## 2. Extra oefening bij een te makkelijke sessie

Na een sessie die als makkelijk beoordeeld is én binnen de tijd bleef, biedt de app één
extra oefening aan uit dezelfde categorie. `afterEasySession` in `extra.ts` loopt de
voorwaarden af en geeft bij een afwijzing de **reden** terug (`niet_makkelijk`,
`deload`, `waarschuwing`, `vorige_had_extra`, …). Dat is bewust: een aanbod dat er niet
is, is anders niet te onderzoeken — niet in een test en niet als je je afvraagt waarom
er niets staat.

**De grootste afweging zat in "bleef onder de geplande duur".** Er was geen starttijd,
alleen `completedAt`. Ik kon de duur schatten uit de sets die je afvinkte, maar dan komt
een sessie die je precies volgens plan doet nooit onder de geplande duur uit — dan zou
het aanbod alleen verschijnen als je wérk had overgeslagen, en dat is het tegenovergestelde
van wat de regel bedoelt. Daarom wordt de duur nu gemeten: `startedAt` komt op het
sessielog bij de eerste aanraking (warming-up instellen of de eerste set bijstellen) en
verandert daarna niet meer. Logs van vóór dit veld leveren geen aanbod op — liever geen
uitspraak dan een schatting die als meting behandeld wordt.

Twee sessies op rij makkelijk gaat een andere kant op: geen oefening erbij, maar het
streefgewicht van het kernwerk omhoog, met dezelfde rem als elke andere verhoging
(`forceIncrease` gebruikt dezelfde `raise` als de gewone progressie — nooit meer dan de
maximale sprong per week, nooit een gewicht dat niet te laden is). Past het gewicht deze
week niet, dan komen er reps bij. Twee makkelijke sessies zijn geen goede dag maar een te
lichte stang, en een zevende oefening lost dat niet op.

De extra oefening komt in de override van die dag (`extraSlot`), niet in het sjabloon:
morgen staat de sessie er weer zoals hij bedoeld is. De keuze is licht-eerst gesorteerd —
een oefening die er ná afloop bij komt hoort het einde van de sessie te zijn, geen tweede
zware kniebuiging op benen die al gedaan hebben.

**Bijvangst die opgelost moest worden:** door de extra oefening kan een sessie een tweede
keer afgerond worden. `completeSession` sloeg daarmee de progressie twee keer aan voor de
oefeningen die er al in stonden. Die slaat nu de slots over waarvan de sets onveranderd in
het vorige log staan, zodat één sessie nooit twee stappen oplevert.

Testdekking: `extraOefening.test.ts` — de gemeten duur (inclusief een afronding vóór de
start en een ontbrekende starttijd), elk van de acht redenen om te zwijgen, de categorie
en de zwaarte van de kandidaat, gevoelige gebieden en reismodus, het doorvoeren van de
verhoging binnen de weekgrens, en het opnieuw afronden zonder dubbele progressie.

## 3. Navigatie binnen een sessie

Drie dingen erbij, alle drie op pure functies in `sessionFlow.ts` zodat ze te testen zijn
zonder de UI aan te raken:

- **vorige/volgende** onder de oefeningnaam, zonder rondlopen — aan de randen houdt het op;
- **de voortgangsbalk bestaat uit knoppen**, dus je springt er direct naar een oefening,
  ook naar een die al af is;
- **een setrij is aantikbaar** en zet de invoer onderin op die set. Het vinkje links blijft
  een aparte knop, dus corrigeren zet de oefening niet terug. Dat was de eis: sets van een
  afgeronde oefening bijstellen zonder de hele oefening terug te zetten.

De gemelde bug zat in de afrondknop. Die keek naar *"is de rest al afgerond"* in plaats
van naar de plek in de sessie, dus een terugsprong naar oefening 1 van 5 met de rest
gedaan zette hem op "Sessie afronden". Nu bepaalt de positie het (`isLastSlot`): afronden
hoort bij de laatste oefening, overal daarvoor ga je naar de volgende. Dezelfde
verandering zit in `volgende()` — die springt nu naar de volgende oefening in de lijst in
plaats van naar de eerstvolgende openstaande, want na een terugsprong wil je bij 2
uitkomen en niet ineens aan het einde van de sessie staan.

De tweede helft van die melding — "alle segmenten gevuld" — was geen fout maar een gat:
de balk liet zien wat af was en niet waar je stond. `stepMark` geeft de huidige stap nu
een eigen markering, ook als die al afgerond is.

Testdekking: `sessieNavigatie.test.ts` — de stappen, de randen, precies het gemelde geval
(terug naar 1 van 5 met de rest gedaan), de markering van de huidige stap, de setkeuze
inclusief onzinnige indexen, plus servergerenderde controles dat de knoppen er ook echt
staan.

## 4. Hardloopafstand zelf bepalen

De +10%-bewaking op het tweewekengemiddelde werkte averechts, en dat is precies de
spiraal die in de melding staat: minder lopen verlaagde het gemiddelde, het lagere
gemiddelde verlaagde het plafond, en dat plafond verlaagde de voorgeschreven afstand
weer. Zondag op 5,5 km terwijl er al maanden 10 km gelopen wordt.

Wat er nu staat:

- **Het venster is een rollend gemiddelde over vier weken op werkelijk gelopen
  kilometers.** Weken zonder enige gelogde loop tellen **niet** mee in plaats van als
  nul. Dat is de motor onder de spiraal die eruit moest: een week zonder telefoon bij de
  hand is geen week van nul kilometer.
- **De duurloop heeft een eigen opbouwlijn**, los van het weekplafond: basis 10 km, een
  halve kilometer per opbouwweek erbij, hard maximum 15 km. Daarboven geen opbouw meer.
  Loop je zelf al verder dan 15 km, dan volgt het voorstel die afstand als onderhoud in
  plaats van je terug te trekken naar de lijn — maar hij bouwt er niet op door.
- **De geplande afstand vul je zelf in** en wordt nergens afgetopt. Op Vandaag staat er
  een eigen blok "Geplande afstand" met een knop *Zelf invullen*; het zat eerst
  weggestopt achter "Meer" en dat past niet bij een keuze die van jou is.
- **Eronder één feitelijke regel**, bijvoorbeeld: *"12 km is +17% t.o.v. je gemiddelde
  duurloop van de laatste vier weken (10,3 km); je langste loop was 11 km."* In het blad
  rekent die regel live mee met de stepper, zodat je ziet wat je kiest terwijl je kiest.
- **De werkelijk gelopen afstand is de maat.** Die werd al geregistreerd; nu rekent
  alles erop en zegt het logblad dat ook met zoveel woorden.

Twee afwegingen die het noemen waard zijn. De eerste: **korte lopen zakken niet meer door
hun ondergrens** om een plafond te halen. Een korte loop van 1 km is geen bijsturing maar
een sessie die z'n doel kwijt is. Gevolg is wel dat de week boven de richtlijn uit kan
komen — dan meldt de app dat (`loopvolume-vooruit`) in plaats van alles in te korten. De
tweede: **"plafond" heet nu "richtlijn"** in de teksten, want dat is wat het geworden is.
De app rekent nog steeds door en zegt nog steeds wat ze ziet; ze houdt niemand meer
tegen. Twee bestaande tests gingen daarop stuk en zijn herschreven naar het nieuwe
contract in plaats van het oude gedrag terug te bouwen.

## 5. Meebewegend weekplafond

Het vaste +10% is een stap geworden die de check-ins volgt (`weeklyGrowth`):

| Situatie | Stap |
| --- | --- |
| twee weken genoeg dagchecks, geen slechte dag, frisse benen, geen zware sessie | **+15%** |
| slechte signalen: een slechte dagcheck, benen op 1-2, of twee zware sessies | **+0%** |
| verder | **+10%** |

De volgorde waarin die regels langskomen is de bedoeling: de rem op doorstijgen komt
eerst. Na drie weken op rij meer kilometers houdt de app het volume gelijk, en die rem is
**blokkerend** — hij heeft geen `dismissKey` en krijgt er ook geen, dus er is geen knop om
hem weg te klikken. Een goede week kan er niet overheen: `weeklyGrowth` valt terug op +0%
zodra de rem staat, ook bij perfecte signalen. Drie weken doorstijgen is precies het
patroon dat pezen sloopt, en een consolidatieweek is goedkoper dan de blessure erna.

De deload is niet aangeraakt: dezelfde drie aanleidingen, dezelfde 30% korting, dezelfde
bevestiging met risicotekst om hem over te slaan. Hij rekent alleen boven op wat de
nieuwe stap oplevert, in plaats van boven op een vast percentage.

## Migratie naar `SCHEMA_VERSION` 14

Eén stap, `v13_to_v14`, met één transformatie: **elke looplog krijgt een expliciete
numerieke `km` en `plannedKm`**. Het weekvolume, het rollend gemiddelde en de opbouwlijn
van de duurloop rekenen allemaal op `km`; oude logs uit de tijd dat gepland en werkelijk
door elkaar liepen kunnen daar een ontbrekend of onleesbaar getal hebben.

De aanvulling is bewust conservatief:

- een **afgeronde** loop zonder afstand valt terug op wat er gepland stond — dat is het
  beste wat we van die dag weten;
- een **niet-afgeronde** loop en een **gefietste** sessie komen op 0. Daar zijn geen
  kilometers gelopen, en een verzonnen getal zou het gemiddelde vier weken lang
  vervuilen. Dat is de duurste fout die deze migratie kon maken.

De nieuwe velden van onderdeel 2 en 3 (`startedAt`, `extra`, `extraSlot`) zijn optioneel
en vragen geen conversie: een log zonder `startedAt` levert simpelweg geen aanbod op.

Testdekking: `migratie.test.ts` heeft er vijf tests bij — de vier gevallen hierboven, een
onleesbaar getal, gepland en werkelijk die uit elkaar blijven staan, de rest van de
gebruiker die onaangeroerd blijft, en een v5-bestand dat in één keer tot 14 doorloopt.

## 6. Wekelijkse review — buiten de app

Staat in **`~/trainingsreview`** op de Pi, buiten dit repo en zonder dependency in de app.
Zelfde patroon als `~/nieuws-poller`: eigen map, eigen venv, eigen `.env`, eigen
systemd-timer met geheugen- en CPU-limiet, eigen logs. De app weet niet dat het bestaat;
het script leest alleen de JSON-export die de app zelf al maakt.

Pijplijn: nieuwste export uit `~/trainingsapp-export` → samenvatting per week → één
Claude-call → mail via SendGrid. De timer draait maandagochtend 07:30.

Twee keuzes die het noemen waard zijn:

- **Niet de hele export naar Claude, maar een samenvatting per week.** De rauwe staat is
  tienduizenden tokens aan losse setjes, en de vraag is wat het *patroon* over de weken
  is. De samenvatting is ~15 kB: kilometers gelopen versus gepland, langste loop en
  duurloop, krachtsessies met beoordeling en gemeten duur, tilvolume, slaap/energie/benen
  als gemiddelde, overgeslagen sessies, de afwijkingen en de streefgewichten.
- **De keys komen uit de omgeving**, nooit uit de code of uit `config.yaml`. Een test
  bewaakt dat letterlijk.

De README zegt wat er nog met de hand moet: twee API-keys in `.env` (los van de
nieuws-poller, zodat verbruik apart zichtbaar blijft), een export in
`~/trainingsapp-export/`, en een geverifieerd SendGrid-afzendadres. Dat exporteren is het
enige wat wekelijks terugkomt — automatiseren kan niet zonder de app te veranderen, en de
opdracht was juist dat dit daar los van staat.

Tests: `test_review.py`, 62 controles, zonder API-call en zonder testframework
(`./run-tests.sh`). Ze dekken de samenvatting per week (inclusief fietsen dat niet als
kilometers telt, losse rondjes die dat wél doen, en niet-afgeronde sessies die niet
meetellen), halve en kapotte exportdata, de gemeten sessieduur, de mailopmaak inclusief
escaping, en de vorm van de Claude-call. De call zelf wordt nagebootst — die kost geld en
zegt niets over deze code.

---

## Wat er niet in zit

- **De extra oefening is een aanbod, geen ingreep.** Er komt werk bij, en dat hoort een
  keuze te zijn. Er is dus geen instelling "voeg automatisch toe".
- **Het exporteren naar de Pi is handwerk.** Zie hierboven; automatiseren zou een
  koppeling tussen app en Pi vragen en dat was expliciet niet de bedoeling.
- **De opbouwlijn van de duurloop is niet instelbaar.** Basis 10, maximum 15, halve
  kilometer per week — die getallen staan als constanten in `running.ts` met de reden
  erbij. Instelbaar maken kan altijd nog; nu zou het een knop zijn zonder vraag.
- **De rem op drie stijgingen achter elkaar is niet uit te zetten.** Dat is de eis, en
  het is ook de enige regel in deze ronde die iets tegenhoudt.
