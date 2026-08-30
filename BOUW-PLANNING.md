# Bouwverslag — weekplanning, achteraf invullen en de loop als sessie

Tak `weekplanning`, afgetakt van `main`. Niet gepusht, niet samengevoegd.

Eerst gecontroleerd of `bijsturing-en-hardloopopbouw` al in `main` zat: dat is zo —
`git rev-list --count main..bijsturing-en-hardloopopbouw` geeft 0, en `SCHEMA_VERSION` 14
staat via 15 en 16 in `main`. De nieuwe tak komt dus van `main`; er gaat niets verloren.

Vier commits, één per onderwerp:

| Commit | Onderwerp |
| --- | --- |
| `2e518d4` | sessies van eerdere dagen: het venster en de volgorde van de progressie |
| `51ac34e` | de hardloopsessie is een sessie geworden |
| `03e79c1` | verplaatsen staat waar je het zoekt |
| `28d828e` | weekplanning: de komende week in één overzicht |

**Stand:** `npm test` 996 tests groen (48 bestanden), `npm run test:server` 89 groen,
`npm run build` schoon, `tsc --noEmit` schoon. Op `main` stond één test rood; die is hier
groen — zie punt 3.

---

## 1. Achteraf invullen van gemiste sessies

### Wat er al kon, en wat er ontbrak

De machinerie kon het al. `completeSession(iso, …)`, `completeRun(iso, …)`, `buildDay`,
`sessionKeyFor` en het sessielog werken allemaal op een datum en niet op "vandaag". Wat
ontbrak was tweeërlei: er was geen route naar een eerdere dag, en er was geen regel die
opving wat een sessie-uit-het-verleden met de rest van de app doet.

### Het venster: de lopende week plus de week ervoor

`src/logic/backfill.ts`, `BACKFILL_WEEKS = 1`. `backfillStart()` is de maandag van de
vorige week; alles daarvóór is dicht.

De afweging: verder terug is niet invullen maar reconstrueren. Hoeveel je twee weken
geleden op de leg press deed weet je niet meer — je gokt het, en dat gokje stuurt daarna
de opbouw bij op iets wat nooit gebeurd is. Een ontbrekende sessie is eerlijker dan een
verzonnen sessie. De grens ligt op een weekgrens en niet op "tien dagen terug", omdat de
hele app in weken denkt (deload, weekkilometers, maximale sprong per week) en een grens
die dwars door een week loopt nergens bij aansluit.

De grens zit in de **UI**, niet in de acties. `A.completeSession` en `A.completeRun` blijven
elke datum aannemen: dat zijn de laagste bouwstenen, ze worden door de bestaande tests met
vaste datums uit augustus 2026 aangeroepen, en een venster is een productregel over wat je
áángeboden krijgt, niet een eigenschap van "een sessie wegschrijven". De schermen weigeren
een te oude dag (`isTooOld`) en de gemiste-lijst biedt hem niet aan.

### De volgorde van de progressie — het echte probleem

Streefgewichten lopen op de tijd. `completeSession` leest de stand van dát moment, telt
`hitStreak` op, kiest hoogstens twee verhogingen en schrijft de nieuwe stand terug. Vul je
op donderdag de sessie van dinsdag in terwijl je woensdag al gelogd hebt, dan komt een
oudere waarheid ná een nieuwere binnen en schrijft eroverheen: de teller loopt terug, het
streefgewicht springt naar wat het dinsdag was.

Drie mogelijke antwoorden gewogen:

1. **Alles opnieuw afspelen** vanaf de eerste sessie, in datumvolgorde. Correct, maar het
   vraagt dat de sessiecontext van elke oude sessie exact te reconstrueren is (deload,
   check-in, kalibratie, welke slots er stonden) en het herschrijft bij elke late invoer
   de hele historie. Veel machinerie, en het risico dat een replay iets subtiel anders
   uitrekent dan de oorspronkelijke sessie is precies het risico dat je niet wilt op de
   getallen waar de app om draait.
2. **Achteraf ingevulde sessies tellen nooit mee voor de progressie.** Simpel, maar fout in
   het gewone geval: je bent gisteren vergeten te loggen en er is sindsdien niets gebeurd
   — dan hoort die sessie gewoon te tellen.
3. **Per oefening kijken of er al iets nieuwers staat.** Dat is het geworden.

`hasLaterLogFor(state, iso, exerciseId)` kijkt of er een afgeronde sessie met een latere
datum bestaat waarin die oefening voorkomt. Zo ja, dan slaat `completeSession` voor díé
oefening de progressie over — geen `applyProgression`, geen streak, geen kandidaat voor
een verhoging. De sessie zelf wordt volledig bewaard.

Per oefening en niet per sessie, omdat het probleem per oefening bestaat: vul je de
beensessie van maandag in nadat je de duwsessie van dinsdag gelogd hebt, dan is er voor
geen enkele beenoefening iets nieuwers en telt hij gewoon mee.

Er komt één regel terug die uitlegt waarom er niets veranderde:

> Achteraf ingevuld: Leg press stuurt de streefgewichten niet — daar staat al een nieuwere
> sessie tegenover. De sessie zelf is bewaard.

### Wat er verder op datum rekende, en waarom het goed komt

| Wat | Gevolg van achteraf invullen |
| --- | --- |
| **Guardrails** (`dayGuardrails`) | Rekenen al per datum. Een sessie op maandag levert de bijsturing van maandag op, niet die van vandaag. Geen ingreep nodig. |
| **Weekrichtlijn hardlopen** | Bestaat niet meer — die is er in `bijsturing-en-hardloopopbouw` uit gehaald. Wat er is, is telwerk: `weekRunFacts` telt per `run.date`, dus een late loop landt in de week waar hij in viel. |
| **Rollend gemiddelde** (`averageRunKm`, `longestRunKm`) | Venster van vier weken op `run.date`. Komt vanzelf goed. |
| **Deloadtelling** (`heavyCountBefore` via `feelsOn`) | Telt 'zwaar' per dag. Een late zware sessie telt mee in de twee weken waar hij in viel — inclusief het gevolg dat de lopende week alsnog een deloadweek kan worden. Dat is bewust niet onderdrukt: de gegevens waren laat, de conclusie niet. |
| **Streefgewichten** | Zie hierboven: per oefening beschermd. |
| **Maximale sprong per week** (`increaseWeek`) | Gebruikt al `mondayOf(opts.iso)`, dus een late sessie belast het budget van zíjn eigen week. |
| **"Twee keer makkelijk op rij"** | Twee reparaties nodig, zie hieronder. |
| **Trainingsstreak** | Loopt terug vanaf vandaag en breekt op een niet-gedane dag. Een gemiste dag alsnog invullen repareert de streak dus vanzelf. |

### De "twee keer makkelijk op rij"-regel

Hier ging het op twee manieren mis.

**Ten eerste de volgorde.** `previousStrengthLog` sorteerde op `completedAt` — het moment
van invullen. Een sessie van vorige week die je vandaag invult heeft daarmee het jóngste
invoermoment van allemaal en werd dus "de vorige sessie" van elke dag erna. Nu sorteert
hij op datum, met `completedAt` als tiebreak (`sortByDate` in `backfill.ts`).

**Ten tweede de nabeschouwing zelf.** `afterEasySession` geeft geen aanbod meer bij een
achteraf ingevulde sessie (`reason: 'achteraf'`). Twee redenen, allebei hard:

- de gemeten duur is dan de tijd die het *invullen* kostte, niet de tijd die de sessie
  duurde — `actualSessionMinutes` rekent `startedAt` tegen `completedAt` weg, en die staan
  vier minuten uit elkaar. Elke achteraf ingevulde sessie zou dus "te makkelijk en ruim
  binnen de tijd" heten;
- het aanbod is "doe er nu nog één oefening bij". Dat kan niet op een dag die voorbij is.

Dat het gewicht omhoog moet is met de nieuwe opbouwregel (`opbouw.ts`, drie sessies op rij
alles gehaald) sowieso al gedekt; die regel loopt gewoon door, mits er niets nieuwers staat.

### Zichtbaarheid

Een sessie van een eerdere dag zegt dat zelf, op de eerste stap van het sessiescherm en
bovenaan het loopscherm:

> **Eerdere dag** — Sessie van vrijdag 28 aug. Je vult hem achteraf in; hij landt op die
> datum, niet op vandaag.

En het planscherm zet er een blok **Nog in te vullen** boven de week, met per gemiste
sessie een knop *Invullen*.

---

## 2. De hardloopsessie als echt sessiescherm

`src/screens/RunScreen.tsx`. Zelfde vorm als het sessiescherm: een volledig scherm met een
eigen weg terug, de invoer binnen duimbereik, en de afronding in een blad.

Wat erop staat: de geplande afstand (te zetten en weg te halen), de werkelijk gelopen
afstand, de duur, het tempo dat live meerekent, en één feitelijke regel uit de bestaande
`runContext`. Afronden opent het blad met *Hoe ging het?* — dezelfde drie knoppen als bij
kracht — en *Opslaan zonder beoordeling*.

**De app blijft van het hardlopen af.** Geen voorgeschreven afstand, geen aftopping op wat
er gepland stond, geen rem, geen voorstel. De enige zin die de app zelf schrijft is de
vergelijking met je gemiddelde loop van deze soort en je langste loop, en die stond er al.
Advies blijft van de krachttraining.

Drie kleinere keuzes:

- **De duur begint op 0** en wordt als `null` opgeslagen zolang hij dat is. Het oude blad
  vulde `Math.round(km * 6)` voor — een verzonnen tempo van 6 min/km dat vervolgens als
  gemeten tijd werd weggeschreven. Voor een app die registreert en niet bedenkt is dat
  precies verkeerd om.
- **De stepper loopt tot 100 km** in plaats van 60. Er wordt niets afgetopt, dus de invoer
  moet geen grens hebben die je in de praktijk kunt raken.
- **De primaire knop op Vandaag heet nu "Start loop"** (of *Loop bekijken* als hij af is),
  net als "Start sessie" bij kracht. Dat is de ene bestaande assertie die ik heb
  bijgesteld: `tests/screens.test.tsx` verwachtte `Loop afvinken`. Afvinken gebeurt nu op
  het loopscherm zelf.

De dagregel op de weekpagina opent nu een loop in plaats van meteen naar de verplaatslijst
te springen. `dayActions` heeft daarom ids `'run' | 'strength'` in plaats van
`'open' | 'move'`; twee asserties in `tests/moveRun.test.tsx` zijn meegegaan, met behoud
van hun bedoeling (elke loop van de week is vanaf de weekpagina te bereiken; een
overgeslagen loop heeft geen knop, een afgevinkte wél — die mag je terugzien).

---

## 3. Verplaatsen zichtbaar maken

### Wat ik aantrof

Verplaatsen was gebouwd en werkte, maar stond op plekken waar je niet kijkt:

1. **Vandaag** — in het blad achter de knop **Meer** onderin. Twee tikken, en de titel van
   dat blad ("De loop", of de naam van de sessie) verraadt niet dat verplaatsen erin zit.
2. **Vandaag, tweede route** — als knop naast een guardrail in het blok *Bijgestuurd*.
   Maar de enige guardrail met zo'n knop is "twee dagen zwaar beenwerk achter elkaar", en
   die vuurt bijna nooit.
3. **De weekpagina** — alleen voor een loop, en alleen als betekenis van de dagregel: je
   tikt op donderdag en belandt in de verplaatslijst. Een **krachtsessie** was daar
   helemaal niet te verplaatsen.
4. **Het sessiescherm** — geen route. Terwijl dat het scherm is waar je staat als je merkt
   dat het vandaag niet gaat lukken.

Het hardste bewijs stond in de suite zelf: `tests/moveRun.test.tsx` → *"geeft de loop van
vandaag een verplaatsknop en een terugknop"* was **rood op `main`**. Die test rendert
Vandaag en zoekt de tekst `Verplaatsen`; die staat niet in de HTML, want het blad is dicht.
De test verwachtte daarna ook `Loop verplaatst naar …` en `Verplaatsing ongedaan maken`,
en die twee stonden er evenmin — de knop heette `Terughalen van za 5 sep`. Er lag dus een
bedoeling vast die nooit gebouwd was.

### Wat het geworden is

- **Vandaag** heeft een blok **Niet vandaag?** in de pagina zelf, met per ding van die dag
  (de loop, de krachtsessie) een eigen knop *Verplaatsen*. En een blok **Verplaatst** dat
  zegt waar iets naartoe is gegaan; de knop onderin heet nu *Verplaatsing ongedaan maken*,
  met de datum in de pagina in plaats van in de knop.
- **Het sessiescherm** heeft het op de warming-up — de eerste stap, en het moment waarop je
  het besluit neemt — en in het oefeningenblad naast *Sessie afronden*.
- **Het loopscherm** heeft het als vaste regel onderaan het scherm.
- **De planpagina** (punt 4) heeft het per sessie.

Het blad achter *Meer* houdt zijn knop: die is er nu voor wie hem daar al gewend was, en
hij kost niets.

**Eén implementatie.** Overal dezelfde `MoveSheet`, dezelfde `moveTargets` en dezelfde
`applyMove`; er is geen tweede verplaatspad bijgekomen. De rustdagblokkade en de conflict-
waarschuwingen komen daardoor overal vanzelf mee.

**Eén beperking, bewust.** Op het sessiescherm gaat *Verplaatsen* op slot zodra er een set
afgevinkt is of de sessie afgerond is. Het sessielog hangt aan de datum (`${datum}:${kind}`),
dus een halfvolle sessie verplaatsen zou de ingevulde sets op de oude dag achterlaten en de
nieuwe dag leeg openen. Het log meeverhuizen kan niet netjes: op de doeldag kan een ándere
soort sessie staan waarmee geruild wordt, en dan is er geen sleutel om naartoe te
schrijven. Een knop die uitstaat met een zichtbare reden is beter dan een verplaatsing die
stilletjes data achterlaat.

---

## 4. Weekplanning

`src/screens/PlanScreen.tsx`, te openen met **Plannen** op de weekpagina; hij plant de week
die je daar op dat moment bekijkt, zodat er geen tweede weeknavigatie bij komt.

De weekpagina blijft wat hij was: een pagina om te lezen, zonder knoppen in de dagregels.
De planpagina is er om te schuiven en bestaat juist uit knoppen. Ze delen `buildDay`, de
`MoveSheet` en de acties; er is niets dubbel gebouwd.

Per dag staat er wat er staat, met per sessie:

| Stand | Knoppen |
| --- | --- |
| gepland | *Verplaatsen*, *Overslaan*, en *Invullen* als de dag binnen het terugwerkende venster valt |
| verplaatst | *Terughalen* |
| overgeslagen | *Toch doen* |
| gedaan | geen — alleen de stand |

Bovenaan een blok **Nog in te vullen**: de gemiste sessies van díé week die nog binnen het
venster vallen, met een knop die het bijbehorende sessie- of loopscherm op die datum opent.

**De rustdag** staat er wel — anders is het geen hele week — maar zonder knoppen, met de
regel die `buildDay` er zelf al bij zet: *"Rustdag. Hier plant de app nooit iets."* Als
bestemming is hij geblokkeerd, en dat is niet hier nagebouwd: het zit in `moveCandidates`
en `moveSession`/`moveRun` weigeren hem ook als je eromheen zou gaan. Per profiel de juiste
dag: woensdag bij Rob, maandag bij Anouc.

**Conflicten blokkeren niet.** Ze staan in de verplaatslijst bij de dag waar ze over gaan,
in oker, met de sessie nog steeds als knop — precies zoals de `MoveSheet` het al deed.

---

## Migratie

**Geen datamigratie, en `SCHEMA_VERSION` blijft 16.**

Wat er aan de opslag verandert is één optioneel veld op `SessionLog` en op `RunLog`:

```ts
/** de kalenderdag waarop deze sessie achteraf is ingevuld; afwezig = op de dag zelf */
backfilledOn?: string
```

De afwezigheid van dat veld heeft een betekenis die voor álle bestaande data klopt: er was
geen route om iets op een eerdere dag te loggen, dus elk bestaand log is per definitie op
de dag zelf gemaakt. Een migratiestap zou dus niets doen, en `migrateUser` laat onbekende
velden ongemoeid (het spreidt de opgeslagen gebruiker uit). Een versienummer ophogen voor
een stap die niets doet maakt het versienummer minder waard, niet meer — zie ook het
argument in `BOUW-SAMENVOEGEN.md` over versies waarvan de inhoud achteraf verandert.

Wat wel gecontroleerd is: `saveSessionDraft` bouwt het sessielog helemaal opnieuw op en
moest het veld expliciet meenemen, net als `warmup`, `extra` en `startedAt`.

Dit betekent ook dat een export uit deze versie leesbaar blijft voor een toestel dat nog op
16 staat: dat leest het extra veld gewoon mee en negeert het.

---

## Testdekking

59 nieuwe tests, in vier bestanden.

| Bestand | Tests | Wat het vastlegt |
| --- | --- | --- |
| `tests/achteraf.test.ts` | 23 | het venster (grenzen aan beide kanten, de melding), de gemiste-lijst (rustdag nooit, volgorde, afgevinkt en overgeslagen vallen af, per profiel), en de progressievolgorde: landt op de eigen datum, telt gewoon als er niets nieuwers staat, laat de gewichten met rust als dat wel zo is, kijkt per oefening en niet per sessie, en legt uit waarom |
| `tests/hardloopsessie.test.tsx` | 13 | het loopscherm: de vier velden, het tempo, geen aftopping, precies de regel uit `runContext` en geen sturende woorden, de beoordeling achter het afrondblad, fietsen, een dag zonder loop, een te oude dag, de eerdere-dagmelding, en beide profielen |
| `tests/verplaatsenVindbaar.test.tsx` | 9 | dat `Verplaatsen` in de HTML van de pagina staat en niet in een gesloten blad — op Vandaag (twee regels bij een dag met loop én kracht), op het sessiescherm, op het loopscherm; dat het op slot gaat zodra er sets staan; en dat het overal dezelfde staat schrijft |
| `tests/weekplanning.test.tsx` | 14 | de week op één pagina, knoppen per sessie, de rustdag zonder knoppen én geblokkeerd als bestemming, verplaatsen/terughalen/overslaan/toch-doen, de gemiste-lijst per week (ook voor de week ervoor, en leeg buiten het venster), en beide profielen |

De schermtests renderen server-side met `renderToString`, zoals de rest van de suite. Waar
"wat staat er vandaag" meespeelt zetten ze de klok vast op de dinsdag van de lopende week
(loop én krachtsessie bij Rob), zodat de uitkomst niet afhangt van de dag waarop de suite
draait.

### Bestaande tests die zijn meegegaan

Drie asserties, alle drie omdat het gedrag er bewust onder veranderd is:

1. `tests/screens.test.tsx` — `Loop afvinken` → `Start loop` op Vandaag (punt 2).
2. `tests/moveRun.test.tsx` — `dayActions` ids `'move'`/`'open'` → `'run'`/`'strength'`.
3. `tests/moveRun.test.tsx` — "toont geen verplaatsknop bij een afgevinkte of overgeslagen
   loop" heet nu "laat een afgevinkte loop nog openen en een overgeslagen niet", met
   dezelfde bedoeling: een overgeslagen sessie heeft geen knop.

De rest van de suite is onaangeroerd, op het mechanische `onOpenRun` na dat bij elke
`createElement(Today | WeekScreen, …)` moest.

---

## Wat er bewust niet in zit

- **Volledig herrekenen van de historie.** De progressie wordt beschermd, niet
  herschreven: een achteraf ingevulde sessie die te laat komt telt niet mee voor de
  gewichten van díé oefening. Wie de hele keten in de juiste volgorde wil herrekenen heeft
  een replay nodig over alle sessies, en dat is een ander project met een ander risico —
  zie de afweging in punt 1.
- **Een venster dat je zelf kunt instellen.** Twee weken is een keuze, geen instelling. Een
  schuifje "hoe ver terug mag ik invullen" nodigt uit tot precies het reconstrueren dat de
  grens moet voorkomen.
- **Bulk-invullen.** Er is geen "vink de hele week af"-knop. Elke gemiste sessie wordt
  apart geopend en ingevuld, want de gegevens per sessie zijn het punt.
- **Vooruit plannen buiten de bestaande grenzen.** `moveTargets` loopt van de dag vóór de
  week tot en met de dag erna. De planpagina erft die grens; hij is niet opgerekt. Ketens
  (A naar B, B naar C) blijven uitgesloten, net als voorheen.
- **Een vierde tab.** De planpagina hangt onder Week, zoals Instellingen onder Historie
  hangt. De navigatiebalk blijft drie bestemmingen breed — dat staat als eis in `App.tsx`
  en die is niet aangeraakt.
- **De README.** Die beschrijft de app uitgebreid en loopt op deze punten nu achter. Hij is
  hier niet bijgewerkt: dat is een aparte, grote tekstronde, en die hoort niet ongemerkt in
  een tak over planning te zitten.
- **De reviewprompt op de server.** Die krijgt de staat zoals hij is en werkt gewoon door;
  hij zegt alleen (nog) niets over sessies die achteraf ingevuld zijn. Als dat later blijkt
  te storen in het advies, is `backfilledOn` het veld waar dat aan opgehangen kan worden.
