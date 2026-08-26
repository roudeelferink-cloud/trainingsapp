# Progressie per profiel — bouwverslag

Branch `progressie-per-profiel`, vanaf `main`. Wat er gebouwd is, wat er onderweg anders
bleek dan gedacht, en wat je zelf nog moet doen.

Twee dingen, uit dezelfde klacht: de app bemoeide zich met hardlopen terwijl dat niet
haar werk is, en ze bemoeide zich niet met kracht terwijl dat het wél is — het
streefgewicht bleef staan omdat het aan een knop hing die niemand indrukt.

---

## 1. Hardlopen uit het advies

Weg:

| Wat | Waar het zat |
| --- | --- |
| De opbouwlijn van de duurloop (10 km, +0,5 per week, dak op 15) | `running.ts` |
| Het weekplafond op het rollend gemiddelde, met de richtlijn eronder | `runningLoad.ts` |
| De rem na drie stijgende weken op rij | `runningLoad.ts` |
| De waarschuwing over zware benen vlak vóór de duurloop | `guardrails.ts` |

En daarmee ook alles wat eraan vastzat: de verdeling kort/kort/lang, het terugschalen van
de resterende lopen, de korting na een zwaar beoordeelde loop, de 30% korter bij een lage
check-in, en de deloadkorting op kilometers. Die gingen allemaal over hetzelfde: een
afstand die de app bedacht.

Blijft: de afstand en de tijd invoeren, het tempo, fietsen in plaats van lopen,
verplaatsen naar een andere dag, en het optellen achteraf. Je kunt nog steeds zelf een
afstand voor een dag zetten — dan staat eronder één feitelijke regel (hoe die afstand zich
verhoudt tot je gemiddelde en tot je langste loop), en verder niets.

Op Vandaag en Week staat nu **wat er gelopen is** in plaats van hoeveel er nog "mocht":
`3× / 34 km`. De grafiek op Historie is kale kilometers per week.

Twee dingen die eruit volgden en die het noemen waard zijn:

- **Twee zware beendagen achter elkaar blijft staan.** Die waarschuwing gaat volledig over
  krachttraining en heeft met de duurloop niets te maken. Hij is wel verhuisd van
  "melden op beide dagen" naar "melden op de tweede dag", want dat is de dag waar je iets
  aan kunt doen.
- **Het wegklikken van structurele meldingen is weg.** De enige melding die zich elke week
  herhaalde was die over benen vóór de duurloop. Zonder die melding is er niets meer om weg
  te klikken, dus `dismissedWarnings` is uit de staat verdwenen (zie de migratie hieronder).

`programs.runMode` is er ook uit: dat onderscheidde "de app rekent afstanden voor" van
"jij bepaalt". Nu geldt het tweede voor iedereen, en dan is het geen keuze meer.

### De prompt naar de Claude API — nog niet gedaan

Dat stond in de opdracht, maar het kán niet op deze branch: `server/` bestaat alleen op
`zelf-hosten-en-advies`, en deze branch komt van `main`. Wat er moet gebeuren zodra die
twee samenkomen staat onderaan onder **Bij het samenvoegen**.

---

## 2. Progressie op data in plaats van op een knop

`src/logic/opbouw.ts`. De regel:

> Haal je een oefening **drie sessies op rij helemaal**, dan gaat het gewicht omhoog.
> Daarna begint de teller opnieuw.

"Helemaal" is alle drie tegelijk:

1. alle geplande sets gedaan — een afgebroken sessie telt niet;
2. elke set haalde minstens de geplande reps;
3. elke set stond op minstens het streefgewicht.

Voorwaarde 3 is waarom een set naar beneden bijstellen als "niet gehaald" telt. Daar staat
geen boete op: de teller gaat naar 0 en je bouwt opnieuw op vanaf wat je wél gehaald hebt.

**De stap** komt uit `plates.ts`, dus uit wat er echt ligt:

| Materiaal | Stap |
| --- | --- |
| Stangwerk (smith, trap bar, barbell, …) | 2,5 kg — twee keer de lichtste schijf, en die is 1,25 |
| Dumbbells | de eerstvolgende maat in het rek (5 → 12,5 → 15 → 17,5 → 20) |
| Leg press | 5 kg |
| Machine met een pin | `minIncrement` van die oefening |

De leg press heeft daarvoor één veld gekregen: `progressStepKg: 5` op de oefening zelf. Dat
is de enige plek waar de kleinste laadbare stap te klein is voor wat er op staat. Zet je in
Instellingen de 1,25 kg-schijven uit, dan wordt de stap bij stangwerk vanzelf 5 kg — de
regel rondt altijd af op een gewicht dat bestaat.

---

## 3. Tempo per profiel

Nieuw in Instellingen, onder **Tempo van de opbouw**: per spiergroep (benen /
bovenlichaam / romp) een keuze tussen *opbouwen* en *onderhoud*.

| | Drempel | Stap |
| --- | --- | --- |
| opbouwen | 3 sessies | de stap die bij het materiaal past |
| onderhoud | 6 sessies | altijd de kleinste stap die te laden is |

Startpunt: **Rob** overal opbouwen, **Anouc** overal onderhoud. De spiergroep volgt uit het
bewegingspatroon van de oefening, dus een nieuwe oefening valt vanzelf in de goede groep
zonder dat er ergens een lijstje bijgewerkt hoeft te worden.

---

## 4. De rem

- **Hooguit twee oefeningen per sessie** gaan omhoog. Drie tegelijk zwaarder is geen opbouw
  maar een andere sessie.
- **Benen eerst.** Daar zit de meeste winst, en als er maar twee stappen in zitten horen ze
  daar terecht te komen. Binnen dezelfde groep wint de oefening die vooraan in de sessie
  staat — dat is ook de oefening waar je het frist aan begint.
- **Niets in een deloadweek.** Daar staat met opzet minder op de stang; een gehaalde sessie
  zegt daar niets over wat je aankunt.

Komen er meer oefeningen aan de drempel dan er stappen zijn, dan blijven die op de drempel
staan en zijn ze de volgende sessie als eerste aan de beurt.

---

## 5. Wat je ervan ziet

Gewicht en reps van elke set stonden al voorgevuld met het voorstel en dat is zo gebleven;
alles is vrij bij te stellen. Nieuw is één regel bij een oefening die net omhoog ging, in
de stijl van de andere contextregels:

> 3× 140 kg × 12 gehaald — nu 145

Die staat er precies één sessie: bij de volgende gelogde sessie is het geen nieuws meer en
haalt de app hem weg. Geen apart scherm, geen bevestigingsknop — de verhoging staat er
gewoon de volgende keer.

---

## 6. De oude "makkelijk"-regel

Die mocht blijven en is gebleven, maar met één verandering die niet in de opdracht stond en
die ik toch nodig had. **De oude regel verhoogde ook zonder die knop.** Zonder beoordeling
viel hij terug op de gelogde RIR: alle sets op de bovengrens met RIR ≤ 2 was genoeg. Met de
nieuwe regel erbij zouden er dan twee regels naar dezelfde sets kijken en om de beurt een
stap nemen — en omdat de oude eerder vuurt, komt de nieuwe nooit aan drie.

Daarom verhoogt de oude route het gewicht nu alleen nog op een expliciete beoordeling. Hij
is daarmee wat de opdracht hem noemt: de handmatige route. Wat níét veranderd is:

- reps opbouwen gaat gewoon door zonder beoordeling — dat is geen stap omhoog, en het is de
  enige weg die het rustige programma van Anouc heeft;
- bandwerk klimt zoals het klom, inclusief de terugval op RIR;
- de 10%-terugval na twee sessies onder de ondergrens.

En daar bovenop de eigenlijke afspraak: gaat het gewicht via de oude route omhoog, dan
telt dat als de stap van die sessie. De teller gaat naar 0 en de opbouwregel slaat die
oefening over. Dat staat vast in `tests/opbouw.test.ts` → *"de oude makkelijk-regel
verhoogt niet dubbel"*.

---

## De regel over de historie in `tests/fixtures/`

**Eerst wat dat bestand is.** `tests/fixtures/export-pages-v14.json` is niet een export van
je telefoon — `~/trainingsapp-export/` op deze Pi is leeg, er is geen echte export. Het
bestand komt van de branch `zelf-hosten-en-advies` en is daar gemaakt door de
`exportJSON()` van de Pages-versie over negen opgebouwde weken te draaien, om het
import-pad te testen. De cijfers hieronder zeggen dus iets over de regel en niets over hoe
hard er getraind is.

De replay draait de gelogde sessies opnieuw af door de échte `completeSession`
(`tests/opbouwHistorie.test.ts`), niet door een nagebouwde versie van de regel.

### Zoals het in de fixture staat

| Profiel | Oefening | Sessies | Meegeteld | Verhogingen | Gewicht |
| --- | --- | --- | --- | --- | --- |
| Rob | leg_press | 9 | 0 | **0** | 140 → 140 kg |
| Rob | bench_smith | 9 | 0 | **0** | 60 → 60 kg |
| Anouc | leg_press | 9 | 0 | **0** | 140 → 140 kg |
| Anouc | bench_smith | 9 | 0 | **0** | 60 → 60 kg |

Nul, en dat klopt: in die sessies staan **twee van de vier geplande sets**, en de tweede
set haalt één rep minder dan de eerste. Twee van de drie voorwaarden zijn dus niet gehaald.
Dat is precies het gedrag dat je wilt — de regel telt alleen mee wat helemaal af is, en
laat een half gelogde sessie met rust.

### Dezelfde negen weken, wél volledig gelogd

Om te laten zien wat de regel dan doet, dezelfde sessies met alle geplande sets op het
voorgevulde gewicht en de voorgevulde reps:

| Profiel | Oefening | Sessies | Meegeteld | Verhogingen | Gewicht |
| --- | --- | --- | --- | --- | --- |
| Rob | leg_press | 9 | 6 | **3** | 140 → 155 kg |
| Rob | bench_smith | 9 | 6 | **3** | 60 → 67,5 kg |
| Anouc | leg_press | 9 | 8 | **1** | 140 → 142,5 kg |
| Anouc | bench_smith | 9 | 8 | **1** | 60 → 62,5 kg |

Daar staat het verschil tussen de twee tempo's in één tabel: Rob gaat drie keer omhoog in
negen sessies (elke derde), met 5 kg op de leg press en 2,5 kg op de smith. Anouc gaat één
keer omhoog (na zes), en dan met de kleinste stap — ook op de leg press.

Deze sessies staan in de fixture één keer per week, dus "negen sessies" is bij Rob negen
weken. In zijn echte week staat benen A vaker dan één keer per negen dagen; de cadans
wordt dan navenant sneller.

---

## Schema-migratie: 14 → 15

Eén stap, `v14_to_v15`, met drie dingen die uit dezelfde verandering komen:

1. **`settings.progressie`** erbij — het tempo per spiergroep. Bestaande gebruikers krijgen
   het startpunt van hun profiel: Rob opbouwen, Anouc onderhoud.
2. **`hitStreak` per oefening** op 0. Met terugwerkende kracht tellen zou kunnen, maar dan
   zou de eerste sessie na de update bij een handvol oefeningen tegelijk het gewicht omhoog
   gooien — precies wat de rem van twee per sessie moet voorkomen.
3. **`dismissedWarnings` weg**, want de meldingen die daarin stonden bestaan niet meer.

Sessies, loops, streefgewichten, check-ins en instellingen blijven onaangeroerd. De stap
heeft eigen tests in `tests/migratie.test.ts`, los van de volledige migratie.

---

## Tests

**881 tests groen** (was 914 op `main`; er zijn er meer bijgekomen dan verdwenen, maar de
drie testbestanden over de hardloopopbouw zijn weg — die testten regels die niet meer
bestaan).

Nieuw:

| Bestand | Dekt |
| --- | --- |
| `tests/opbouw.test.ts` | de regel zelf: wanneer een sessie meetelt, de stap per materiaal, de tempo's per spiergroep, de rem van twee per sessie met benen eerst, geen verhoging in een deloadweek, de uitlegregel op het sessiescherm, en dat de oude regel niet dubbel verhoogt |
| `tests/opbouwHistorie.test.ts` | de regel over de historie in `fixtures/`, afgedraaid door de echte `completeSession` |
| `tests/hardlopen.test.ts` | dat de app géén loopadvies meer geeft — de helft van dat bestand test dat er iets *niet* gebeurt |

Verdwenen: `hardloopopbouw.test.ts`, `runningLoad.test.ts`, `running.test.ts`.

---

## Wat jij nog moet doen

1. **Pushen.** Ik heb niet gepusht.
2. **Je tempo controleren** in Instellingen → Tempo van de opbouw. De startwaarden zijn een
   gok op basis van wat je verteld hebt, geen meting.
3. **Kijken of de eerste verhoging klopt** als je drie sessies verder bent. De regel gaat
   uit van de streefwaarden die er nú staan; die komen uit de oude regel en zijn nooit
   tegen deze drempel aangehouden.

### Bij het samenvoegen met `zelf-hosten-en-advies`

Die branch heeft `server/` met de review-endpoint, en die twee raken elkaar op drie
plekken. Geen daarvan is moeilijk, maar ze komen alle drie niet vanzelf goed:

1. **`server/src/signalen.ts` compileert niet meer.** Hij importeert `weekLoad`,
   `longRunTarget`, `weekProjection`, `rollingReference`, `risesInARow` en
   `legRunConflict`; die bestaan geen van alle nog. Vervang het hele `loopvolume`-blok
   door de feiten die er wel zijn: `weekRunFacts` (aantal en kilometers), `longestRunKm`
   en `averageRunKm`.
2. **De prompt moet hardlopen als feit behandelen, niet als onderwerp van advies.** In
   `server/src/prompt.ts` bij het veld `advies`: laat er staan dat adviezen uitsluitend
   over krachttraining gaan, en dat kilometers hooguit als context genoemd worden. In de
   systeemprompt hoort erbij dat de app geen loopplanning meer doet, zodat het model niet
   uit zichzelf een afstand gaat voorstellen.
3. **Allebei de branches zetten `SCHEMA_VERSION` op 15**, met een andere migratie eronder.
   Bij het samenvoegen wordt er één van de twee 16, en dan moeten `MIGRATIONS` en de
   testverwachtingen mee. De twee stappen bijten elkaar niet — de een voegt `review` toe,
   de ander `progressie`/`hitStreak` en haalt `dismissedWarnings` weg — dus ze zijn na
   elkaar te draaien in willekeurige volgorde.

Eén ding dat ik onderweg opzij heb gezet: er stond nog een ongecommitte regel `server/.env`
in `.gitignore` op de andere branch. Die staat in de stash (`git stash list`), want hij
blokkeerde het uitchecken van `main`. Hij is overbodig — het patroon `.env` dekt hem al —
maar hij is niet weg.
