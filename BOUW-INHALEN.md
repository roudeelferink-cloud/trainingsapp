# Bouwverslag — inhalen, RIR eruit, en wat je de vorige keer deed

Tak `inhalen-en-vorige-keer`, afgetakt van `main` (`210e5c3`). Niet gepusht, niet
gedeployd, niet samengevoegd.

Drie commits:

| Commit | Onderwerp |
| --- | --- |
| `fd3e4df` | RIR eruit, en wat je de vorige keer deed erin |
| `16ceece` | een gemiste sessie vandaag oppakken, en historie per oefening |
| `9c6d21d` | randgevallen van het oppakken, en de README bij |

**Stand:** `npm test` 1052 groen (51 bestanden), `npm run test:server` 89 groen,
`npm run build` schoon, `tsc --noEmit` schoon. Op `main` stond één test rood; die is hier
groen — zie [Wat er onderweg stuk stond](#wat-er-onderweg-stuk-stond).

---

## 1. Een gemiste sessie vandaag oppakken

### Wat er niet kon

Een sessie van zondag was niet als sessie van dinsdag te doen. Drie dingen zaten in de weg,
en ze zaten er alle drie om een goede reden:

1. **`moveTargets` loopt van de dag vóór de week van de bron tot de dag erna.** Vanuit
   vorige week kom je daarmee hooguit op maandag uit. Dat venster is verstandig voor
   verplaatsen — een sessie drie weken vooruit schuiven is geen planning meer — maar het
   sluit precies de dag uit waar het hier om gaat.
2. **`applyMove` ruilt met de doeldag.** Staat er op de doeldag iets, dan wisselen de twee
   van plek. Bij een bron in het verleden betekent dat: de sessie van vandaag verhuist naar
   gisteren. Gisteren is voorbij; die sessie is daarmee stilletjes weg.
3. **Vanuit de huidige week was een gemiste sessie van vorige week onzichtbaar.** Week en
   Plannen gebruikten `missedInWeek` op hun eigen week, dus wie op dinsdag naar deze week
   keek zag de zondag ervoor niet staan.

En wat er wél was — *Invullen* — beantwoordt een andere vraag. Achteraf invullen zegt "dit
deed ik toen" en logt op de oude datum. Op dinsdag denken dat je die beensessie van zondag
alsnog gaat doen is iets anders: dat is "dit doe ik nu".

### `pickUpToday` — geen verplaatsing, en nooit achteruit

`src/logic/day.ts`. De kern is één regel state: **de brondag wijst naar vandaag, en verder
niets.** Geen omgekeerde pijl, dus geen ruil, dus nooit een sessie die in het verleden
belandt.

```
moves[oorsprong] = vandaag
```

Daaromheen staan de voorwaarden, in de volgorde waarin ze de vraag beantwoorden:

- de bron ligt in het verleden en binnen het terugwerkende venster (`isBackfillDate`,
  dezelfde grens als achteraf invullen: deze week plus de week ervoor);
- daar staat een geplande sessie die niet gedaan en niet overgeslagen is;
- vandaag is geen rustdag — anders `REST_DAY_REASON`, letterlijk dezelfde tekst als de
  verplaatslijst gebruikt.

De functie **beslist niet** wat er met de sessie van vandaag gebeurt als die er is. Ze geeft
een `conflict` terug met twee dingen erin: hoe die sessie heet, en de eerstvolgende dag waar
hij naartoe kan. De aanroeper stelt de vraag; met `resolve` erbij wordt het antwoord
uitgevoerd. Dat onderscheid is bewust — er wijkt hier iets, en dat is geen keuze die een
functie in stilte hoort te maken.

### De twee antwoorden

**`shift`** — de sessie van vandaag schuift door naar de eerstvolgende dag die vrij is:
geen rustdag, nog geen sessie van die soort, en niet al aan een verplaatsing bezig
(`nextFreeDay`). Tot en met de dag na deze week; verder vooruit schuiven maakt van één
gemiste sessie een gemiste week. Dat gaat via de bestaande `moves`/`runMoves` en via
`applyMove`, dus het is een gewone verplaatsing die overal in de app al klopt.

**`skip`** — de sessie van vandaag ruilt van plek met de opgepakte sessie en staat op die
oude dag als **overgeslagen**, met `ingehaald` als reden.

Dat is de enige plek waar ruilen met het verleden wél mag, en het waarom is precies de
reden dat het elders niet mag: een sessie die je nog moet doen hoort niet op een dag te
staan die al voorbij is, maar een sessie die **niet meer gebeurt** doet daar geen kwaad. Zo
blijft zichtbaar dát hij er stond en waarom hij niet doorging, in plaats van dat hij
geruisloos verdampt.

Waarom niet simpelweg `skips[vandaag] = ingehaald` en klaar? Omdat een dag in dit model
precies één krachtsessie en één loop heeft, bepaald door de weekdag plus `moves`. Een
overgeslagen sessie bezet dat slot nog steeds; de opgepakte sessie zou nergens kunnen
landen. Het slot moet dus echt leeg, en leeg betekent hier: de sessie staat ergens anders.

Is er geen dag om naar door te schuiven, dan wordt `shift` vanzelf `skip`. Doorschuiven
naar niets bestaat niet.

### Geen ketens, aan beide kanten

`moveCandidates` liet al dagen vallen die zelf aan een verplaatsing meedoen. Dezelfde regel
geldt hier, maar hij moest aan twee kanten opnieuw doordacht worden.

**Aan de kant van vandaag.** Is de sessie die vandaag staat zelf al ergens vandaan gekomen,
dan is doorschuiven geen optie meer (`shiftTo: null`) en blijft overslaan over. `vacateToday`
handelt dat af in twee lagen: de sessie die hier naartoe verplaatst was gaat terug naar zijn
eigen dag en staat daar overgeslagen, en wat er daarna nog van deze dag zelf overblijft ruilt
van plek met de opgepakte sessie. Twee sessies die niet doorgingen, allebei met de reden
erbij, en geen enkele die zoekraakt.

**Aan de kant van de bron.** Stond de gemiste sessie daar zelf als verplaatsing, dan wordt
díé verplaatsing eerst teruggedraaid en verhuist de oorspronkelijke dag mee. Zonder dat komt
er een tweede schakel aan de ketting en verdwijnt de sessie die op de brondag hoorde. Wat
door het terugdraaien terugvalt op zijn eigen dag staat daar gewoon weer open — en is dus
zelf ook op te pakken.

En het randgeval dat pas bij het uitschrijven opviel: kwam de sessie van **vandaag** — je
had hem naar een eerdere dag gehaald en daar laten liggen — dan is dat terugdraaien het hele
antwoord. Zonder die uitzondering wees de dag naar zichzelf.

### Op het scherm

**Vandaag** krijgt een blok **Nog open**, boven de sessie van de dag, en alleen als
`missedSessions` iets oplevert. Per regel `datum · naam` met drie keuzes: *Vandaag doen*,
*Achteraf invullen* (de bestaande route) en *Overslaan*. Alleen de eerste is oker — er staat
er maar één voorop, en `Link` heeft daarvoor een `tone="quiet"` gekregen.

Bij een conflict komt er een blad: "Vandaag staat al [naam]. Er kan er maar één staan, dus
die van vandaag wijkt — doorschuiven of overslaan." Kan doorschuiven niet, dan staat er
waarom in plaats van een knop die niets doet.

Na het oppakken toont de sessie **"van zo 6 sep"**, zoals bij een verplaatsing. Dat stond er
nog nergens op Vandaag — nu wel, en meteen voor gewone verplaatsingen ook: in de leadregel
boven de kop, en in de meta van de tweede sessie van de dag. En hij logt op vandaag: geen
`backfilledOn`, dus hij telt gewoon mee voor de progressie. Dat is het hele verschil met
achteraf invullen.

**De verplaatslijst** zet vandaag vooraan zodra de bron in het verleden ligt en nog binnen
het venster valt, ook buiten de negen dagen van het gewone venster. De kop "Later deze week"
heet dan "Vandaag of later".

**Week en Plannen** tellen nu via `openForWeek`: op de pagina van de huidige week is dat het
hele venster, dus ook wat er van vorige week nog open staat. Op elke andere week blijft het
die week — die kun je niet meer inhalen, alleen nog invullen. De planpagina kreeg dezelfde
drie acties als Vandaag.

**Guardrails** worden op de nieuwe datum beoordeeld, net als bij verplaatsen: twee zware
beendagen achter elkaar, en de geschatte duur — twee sessies op één dag is precies het geval
waarin die uit de hand loopt. Ze waarschuwen en houden niets tegen; ze komen na het oppakken
in een blad te staan, en daarna elke dag gewoon in het bijsturingsblok van `buildDay`.

### Eén nieuwe skip-reden, en een normalisatie

`SkipReason` heeft er `ingehaald` bij. Die kies je niet zelf: `SKIP_CHOICES` in het nieuwe
`src/logic/skips.ts` houdt de vier bestaande redenen over voor de kiezer, en `SKIP_LABEL`
kent ze alle vijf voor de weergave. Dat lijstje stond met de hand nagebouwd op Vandaag én op
de planpagina; nu staat het één keer.

De opgeslagen skips gaan sinds deze ronde langs een normalisatie in `migrateUser`: een reden
die de app niet kent, of een `what` die bij geen enkel blok hoort, verdwijnt. Zonder dat zou
een half importbestand een leeg label op het scherm opleveren.

---

## 2. RIR volledig uit de app

Elke set had een getal: hoeveel herhalingen zaten er nog in het vat. Het moest tijdens de
sessie ingevuld worden, het stond standaard op 2, en het werd zelden bijgesteld — dus stond
er meestal een 2 die niets zei.

Erger dan nutteloos was dat het **dubbel werk** deed. Sinds `opbouw.ts` de progressie op de
gelogde sets doet en de beoordeling na afloop de handmatige route is, was de RIR een derde
maat die af en toe stilletjes de doorslag gaf.

Weg uit: `LoggedSet`, `sessionFlow` (de voorvulling en het doorzetten naar de volgende set),
de gelijkheidscheck in `completeSession`, de setrij, het bewerkveld, en alle teksten.
`CALIBRATION_TEXT` en de kalibratienoot in `day.ts` zijn nu "train op gevoel, stop met 2-3
herhalingen in de tank" — dezelfde instructie in gewone taal. De afrondtekst over terugvallen
op RIR is vervangen door wat er echt gebeurt: zonder beoordeling doet de opbouwregel het werk
op de gelogde sets.

In `progression.ts` geeft `feelSaysGo` zonder beoordeling nu `false`, en `reason` neemt
alleen nog een beoordeling aan. De handmatige route verhoogt dus alleen nog op een
beoordeling.

**Dat heeft één gevolg dat vermelding verdient:** ook **bandwerk** verhoogt nu alleen nog op
een beoordeling. `bandProgression` gebruikte `feelSaysGo` en viel dus terug op de RIR, en
`opbouw.ts` slaat bandwerk expliciet over (`geen_streef` — daar staat geen streefgewicht
tegenover). Een zwaardere band vraagt daarmee om één tik na afloop. Dat is de instructie
gevolgd, en het is verdedigbaar — de beoordeling is de enige maat die er nog is — maar het is
wel een gedragswijziging die niet in de opdracht benoemd stond. De bandtests leggen hem vast:
één die zegt dat er zonder beoordeling niets gebeurt, en de rest geeft er nu een mee.

---

## 3. "Vorige keer" per oefening

Op de plek waar de RIR stond staat nu iets dat wél iets zegt. Onder de oefeningkop, boven de
setrijen, één regel:

```
vr 4 sep · 100 × 12 · 100 × 12 · 100 × 10 · nu 102,5
```

De laatste afgeronde sessie van deze oefening, **ongeacht het sessietype** — leg press in een
beensessie en leg press in een full body zijn dezelfde oefening voor je benen. Het
streefgewicht van nu staat erachter als het afwijkt. Geen knop, alleen tonen.

De logica staat in het nieuwe `src/logic/history.ts`: `lastSessionFor(state, exerciseId,
beforeIso)` en `historyFor(state, exerciseId, weeks)`, allebei op `state.sessions` met
`completedAt`. Beide lopen over de **datum** van een sessie en niet over het invoermoment:
een sessie van vorige week die je vandaag achteraf invulde heeft het jongste invoermoment van
allemaal, maar hij is niet de vorige keer van vandaag. Alleen bij twee sessies op dezelfde dag
beslist het invoermoment, en dat is dan ook de enige plek waar het meetelt.

De regel zelf is een gedeeld component (`components/Sets.tsx`), want de historiepagina toont
precies dezelfde. Bij dumbbells staat "per dumbbell" erachter en bij bandwerk het niveau in
plaats van kilo's — de bestaande conventies uit `dumbbell.ts` en `band.ts`.

---

## 4. Historie per oefening

Onder Historie staat **Per oefening**: alles wat je ooit gelogd hebt, laatst gedaan bovenaan,
met het aantal sessies erbij. Tikken opent een eigen pagina met een kleine lijn van het
hoogste setgewicht per sessie over 12 weken (de bestaande `LineChart` — SVG, tokens uit
`theme.css`, geen chartbibliotheek) en daaronder de sessies als lijst met dezelfde setregels
als in punt 3. Alleen kijken: hier valt niets te bewerken. Een historiescherm waar je per
ongeluk een sessie van drie weken terug kunt aanpassen is geen historie meer.

De pagina hangt onder Historie zoals Instellingen dat doet — een eigen scherm over de app
heen, geen vierde tab die de andere drie smaller maakt.

Bij bandwerk gaat de lijn over het bandniveau in plaats van kilo's, en heet het blok ook zo.

---

## Migratie v16 → v17

`SCHEMA_VERSION` staat op 17. De stap strippt `rir` uit elke opgeslagen set, per gebruiker,
per sessie, per slot. Gewichten, reps, bandniveaus en vinkjes blijven precies zoals ze waren;
er verdwijnt één getal en geen enkele sessie.

Oude exports blijven importeerbaar en komen er schoon uit: een bestand van v14 loopt de hele
keten door en passeert deze stap onderweg. Voor een bestand dat zichzelf al v17 noemt maar
het veld tóch meedraagt is er een tweede net: `migrateUser` normaliseert de sessies bij elke
laadbeurt en bij elke import met dezelfde `stripRir`. Half-kapotte logs (een sessie die geen
object is) blijven daarbij staan zoals ze zijn — wegwerken is niet aan die functie, en een
bestaande test legde dat al vast.

De overzet-test op de echte v14-export uit `tests/fixtures/` controleert nu expliciet
allebei: dat het veld er in de fixture ín zat, dat het er na de import úít is, en dat er
verder niets kwijt is.

---

## Wat er onderweg stuk stond

**Eén test op `main` was al rood.** `opbouw.test.ts` rendert het sessiescherm op de vierde
maandag na een vaste startdatum in augustus 2026. Die dag is inmiddels ouder dan het
terugwerkende venster, dus het scherm weigerde hem — de test hing aan de dag waarop de suite
draait. Hij rendert nu op de maandag van deze week; de regel waar het over gaat hangt aan de
oefeningstaat en niet aan de datum.

**De schermtest die op `RIR` matchte** controleert nu het tegenovergestelde: dat het er niet
meer staat, en dat gewicht en reps er wel zijn.

---

## Een module die moest verhuizen

`day.ts` heeft het terugwerkende venster nodig (`isBackfillDate`) om te weten of een sessie
nog op te pakken is. Maar `backfill.ts` importeerde `buildDay` uit `day.ts` voor
`missedSessions`. Twee modules die elkaar aanroepen zijn twee modules die je niet los kunt
lezen, en de importvolgorde bepaalt dan of het toevallig werkt.

Opgelost door de laag te splitsen op wat hij nodig heeft in plaats van op het onderwerp:

- `backfill.ts` houdt het venster en de volgorde van de progressie: datums en logs, verder
  niets. Het ligt daarmee onder `day.ts`.
- het nieuwe `gemist.ts` heeft de hele dagopbouw nodig — de rustdag, de optionele zaterdag
  die in een deloadweek wegvalt, de naam van een blok — en ligt dus boven `day.ts`. Daar
  staan `missedSessions`, `missedInWeek` en het nieuwe `openForWeek`.

`runName` is bij die verhuizing naar `day.ts` gegaan: hij noemt een `RunBlock`, en dat is een
begrip van `day.ts`. Zo staat hij één keer in plaats van twee.

---

## Testdekking

Nieuw: `tests/inhalen.test.ts` (25), `tests/inhalenScherm.test.tsx` (8),
`tests/historie.test.tsx` (21).

Wat er vastligt:

- **Over de weekgrens** — de duurloop van zondag naar de maandag erna, en vanuit vorige week
  op dinsdag uitkomen waar `moveTargets` dat niet kon.
- **Nooit ruilen met een verleden dag** — de sessie van vandaag verhuist bij `shift` naar een
  vrije dag vooruit, nooit naar de brondag.
- **Conflict, allebei de antwoorden** — `shift` zet de sessie van vandaag op de eerste vrije
  dag (zondag: woensdag is rustdag, donderdag t/m zaterdag zijn bezet); `skip` zet hem
  overgeslagen op de brondag. En `shift` wordt `skip` zodra er geen vrije dag meer is.
- **Rustdag** — geblokkeerd, met dezelfde tekst als de verplaatslijst.
- **Ketens** — aan de kant van vandaag (alleen overslaan, en wat er dan met beide sessies
  gebeurt) en aan de kant van de bron (de verplaatsing wordt teruggedraaid, de sessie die op
  de oorspronkelijke dag hoorde raakt niet zoek).
- **Loop en kracht op dezelfde dag** — de een oppakken raakt de ander niet, in beide
  richtingen.
- **De sessie telt gewoon mee** — logt op vandaag, zonder `backfilledOn`.
- **Guardrails** — de waarschuwing over twee zware beendagen komt op de nieuwe datum, en
  houdt niets tegen.
- **`history.ts`** — de vorige keer over sessietypes heen, op datum en niet op invoermoment,
  concepten tellen niet mee, het venster van `historyFor`, de volgorde van
  `loggedExercises`, en de naar beneden bijgestelde set.
- **De migratie** — `ingehaald` overleeft een rondje opslaan en inlezen, een onbekende reden
  niet; en de v14-export komt schoon binnen zonder verlies.

---

## Aannames

Dingen die de opdracht openliet en waar ik een keuze in gemaakt heb:

1. **"Bij een bron in het verleden vandaag altijd als eerste doel"** is begrensd op het
   terugwerkende venster. Een sessie van drie weken terug valt buiten alles wat je er nog
   mee kunt, en zonder die grens zou elke verplaatslijst van elke oude testdatum er een
   extra dag bij krijgen.
2. **"Naar beneden bijgesteld"** is gedefinieerd binnen één sessie: een set die lichter stond
   dan de zwaarste set van diezelfde oefening in diezelfde sessie. Het streefgewicht van dat
   moment is niet meer te achterhalen uit een log, en dit is precies wat je in de regel ziet.
   Herkenbaar gemaakt met `text-faint`, één toon zachter — de app gebruikt oker voor maar
   twee dingen, en dit is er geen van.
3. **De komma.** De regel schrijft "nu 102,5", zoals de opdracht hem opschreef. Elders op
   hetzelfde scherm staat "Streef 102.5 kg" met een punt, want `fmt` in `progression.ts`
   doet dat al zolang de app bestaat. Ik heb `fmt` niet omgezet: dat raakt tientallen
   bestaande verwachtingen en hoort een eigen ronde te zijn. De nieuwe regels gebruiken
   `weightLabel`, dat `fmt` plus een komma is.
4. **Het weekplafond** uit "guardrails (weekplafond, beenbelasting, duur)" bestaat niet meer:
   dat ging over hardloopkilometers, en de app bemoeit zich sinds een eerdere ronde niet meer
   met de loopplanning. Beenbelasting en duur worden wel beoordeeld op de nieuwe datum.
5. **Twee skips bij een keten.** Als de sessie van vandaag zelf een verplaatsing is én deze
   dag ook een eigen sessie heeft, levert "overslaan" twee overgeslagen sessies op. Dat is
   wat er feitelijk gebeurt — twee sessies gaan niet door — en beide staan met reden en dag
   in de historie in plaats van dat er één verdwijnt.
6. **Het blok "Nog open" toont alles wat er open staat**, zonder maximum. Op een verse
   installatie zijn dat er acht en staat de sessie van vandaag ver naar beneden. Een limiet
   zou dingen verbergen die je juist moet zien; als het in de praktijk in de weg zit, is
   inklappen na de derde regel de goedkoopste ingreep.
7. **De README** stond nog op `schemaVersion` 12 en beschreef de RIR als de terugval van de
   progressie. Dat is bijgewerkt, inclusief de migratiestappen v13 t/m v17 die er nooit in
   gezet zijn, omdat een verkeerde beschrijving van weggehaald gedrag erger is dan geen
   beschrijving.

---

## Wat er bewust niet in zit

- **Een sessie oppakken van verder terug dan het venster.** Dat is geen inhalen meer maar
  reconstrueren, en de grens ligt op dezelfde plek als bij achteraf invullen.
- **Meerdere sessies van dezelfde soort op één dag.** Het model geeft een dag precies één
  krachtsessie en één loop. Dat is de reden dat er bij een conflict iets moet wijken, en het
  is niet iets om en passant open te breken.
- **Een knop om een opgepakte sessie terug te zetten.** Dat is de bestaande
  *Verplaatsing ongedaan maken* op Vandaag; er is niets nieuws voor nodig.
- **De 1RM-grafiek en de nieuwe pagina per oefening samenvoegen.** Ze staan nu naast elkaar
  op Historie en overlappen deels. Dat is één ronde opruimen waard, maar niet deze.
