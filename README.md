# Trainingsschema

PWA voor twee gebruikers, elk met een eigen trainingsschema, samen op één toestel.
Offline-first, installeerbaar, donker thema. Geen accounts, geen wachtwoorden en geen
cloud: alles staat in `localStorage` op het toestel zelf. Verhuizen naar een ander
toestel gaat via export en import.

- **Rob** — doorlopend krachtschema met nadruk op benen, naast 3x per week hardlopen.
- **Anouc** — 2x full body (woensdag en zaterdag) van 45-60 min, naast haar eigen 3x
  hardlopen.

## Draaien

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + productiebuild in dist/
npm run preview    # serveert dist/ op http://localhost:4173
```

De service worker draait alleen in de productiebuild. Test installeren en offline
gebruik dus via `npm run preview`, niet via `npm run dev`.

Let op bij testen op je telefoon: service workers vragen een secure context, dus
`localhost` of HTTPS. Via `npm run preview -- --host` op een LAN-adres laadt de app wel,
maar registreert de service worker niet — geen installatie, geen offline. Daarvoor is
GitHub Pages (HTTPS) nodig.

## Testen

```bash
npm test           # eenmalig, dit draait ook in CI
npm run test:watch # blijft draaien tijdens het werken
npm run typecheck  # alleen TypeScript
```

De suite staat in `tests/` en draait op vitest, zonder browser:

| Bestand | Dekt |
| --- | --- |
| `library.test.ts` | bibliotheek-invarianten: ≥6 oefeningen per patroon, unieke ids, geldige `bodyweightAlternative`, kuit/abductie blijven `core`, zaterdag zonder zware beenbelasting |
| `cycle.test.ts` | weeknummer, cyclusweek, kalibratie, rotatie na 3 cycli |
| `day.test.ts` | weekstructuur, woensdag altijd leeg, deload, check-in-afschaling, korte versie, gevoelige gebieden, reismodus, verplaatsen/ruilen, de geplande loopafstand per dag en de geschatte duur |
| `running.test.ts` | de kale rekenkunde van het loopschema: opbouw per week, de verdeling kort/kort/lang en het afronden |
| `runningLoad.test.ts` | het weekplafond op het rollend gemiddelde, werkelijk gelopen kilometers inclusief losse rondjes, terugschalen na een te lange loop, de rem na een zware loop, handmatige afstanden en de deloadkorting |
| `progression.test.ts` | streefwaarden, progressie op gewicht en op reps, double progression op gevoel, de maximale sprong per week, het uitsmeren van een te grote stap en de −10%-regel |
| `plates.test.ts` | afronden op wat te laden is: schijven per paar, stanggewicht, het dumbbellrek en bandwerk zonder kilo's |
| `deload.test.ts` | de drie aanleidingen (drie zware sessies, twee slechte weken, elke achtste week), het overslaan met bevestiging en de kortingen |
| `duration.test.ts` | de geschatte sessieduur en de waarschuwing boven het uur, met een accessoire als voorstel |
| `guardrails.test.ts` | het schema uitlezen langs verplaatsingen, het tijdvenster van 24 en 48 uur, het structurele weekpatroon en het wegklikken ervan, twee zware beendagen achter elkaar, en één uitlegregel per bijsturing |
| `legLoad.test.ts` | de beenbelasting per sessie: welk werk zwaar of licht telt, de sets, het deel van je 1RM, lichaamsgewicht en band, en de deloadkorting |
| `verplaatsen.test.ts` | verplaatsen in beide richtingen: naar voren halen, ruilen, over de weekgrens, woensdag geblokkeerd, de waarschuwingen vooraf en de guardrails die op de nieuwe datum blijven gelden — voor beide profielen |
| `moveSheet.test.tsx` | de keuzelijst zelf: beide richtingen met een kopje, de rustdag grijs met reden, en een waarschuwing die de dag niet uitschakelt |
| `gevoel.test.ts` | de beoordeling per sessie, de dagcheck, gepland versus werkelijk gelopen, het vastleggen van afwijkingen en het overslaan van een deload |
| `stats.test.ts` | streaks, 1RM-reeks, eiwitdoel, exportherinnering |
| `coaching.test.ts` | elke oefening heeft een gevulde setup, execution en mistake |
| `figure.test.tsx` | elke oefening met `hasFigure` heeft twee complete hoekensets die binnen beeld blijven en foutloos renderen |
| `startWeight.test.ts` | startgewichtadvies: met en zonder lichaamsgewicht, met en zonder vergelijkbare data, afronding, verdwijnen na de eerste set, en de verwijzingen bestaan en zijn niet circulair |
| `store.test.ts` | export/import-roundtrip, afwijzen van onzin en van nieuwere versies, migratie van oudere `schemaVersion`, aanvullen van ontbrekende instellingen in v7 → v8 |
| `settingsScreen.test.tsx` | het instellingenscherm op data die niet uit deze versie komt: lege staat, v5-data, ontbrekende stanggewichten, een tweede gebruiker zonder settings, de import van een oude export en onleesbare waarden |
| `gegevensbeheer.test.tsx` | de eerste-start-keuze, de onderbalk zonder profielschakelaar, wisselen zonder dataverlies, de pincode (instellen, wijzigen, knop blijft uit bij een foute code, blokkade na drie pogingen), de exportwaarschuwing en het wissen per profiel |
| `errorBoundary.test.tsx` | het vangnet rond de schermen: doorlaten als er niets misgaat, leesbare melding met de knop terug naar Vandaag, en loggen naar de console |
| `screens.test.tsx` | elk scherm rendert (server-side, vangt render-fouten) |
| `users.test.ts` | twee gebruikers: eigen schema, eigen logs en instellingen, en de bevestiging dat progressie, gewichtsadvies, 1RM en weekvolume strikt per gebruiker blijven; plus het full body-schema van Anouc (dagen, duur, materiaal, rustiger opbouw, lichter startpunt) |
| `migratie.test.ts` | opgeslagen data van eerdere versies: bestaande data naar gebruiker Rob, een v1-bestand in één keer door, herhaald migreren, kapotte gebruikersdata, en het opruimen van de syncvelden in v8 → v9 zonder de historie te raken |
| `activities.test.tsx` | losse activiteiten: toevoegen (ook op een rustdag en een eerdere datum), bewerken, verwijderen, afstand en gemiddeld tempo, migratie v4 → v5, de bevestiging dat ze de krachtprogressie en 1RM-grafiek niet raken, en dat een los rondje hardlopen mét afstand wél in de weekkilometers telt |
| `setRow.test.tsx` | de invoervelden in een setrij: minimumbreedte, 16px tekst, vaste knopbreedte en wrappen in plaats van samenknijpen — voor elke setrij van elke sessie |
| `barWeight.test.ts` | welke oefening een stang gebruikt, het instelbare stanggewicht, schijven ↔ totaal en de migratie naar v7 |
| `dumbbell.test.ts` | de dumbbell-conventie: gewicht per dumbbell, reps per zijde bij eenarmig werk, de interne ×2 in volume en advies, de labels in de UI, en het rek (5 / 12,5 / 15 / 17,5 / 20 kg) waar het advies naartoe afrondt |
| `band.test.ts` | het nieuwe materiaal: mini-band en enkelmanchet als equipment, de heupabductie-oefeningen met hun tags en uitleg, loggen op bandniveau zonder kilo's (geen tilvolume, geen 1RM), de progressie over de niveaus, en het doorgroeien naar de kabelvariant |
| `moveRun.test.tsx` | loopsessies verplaatsen: ruilen, ongedaan maken, geen ketens, los van de krachtsessie, de knop per loopregel op de weekpagina, en de scheiding per gebruiker over een herlaadbeurt heen |
| `order.test.ts` | de vaste volgorde: `orderCategory` op elke oefening, sorteren en de sjabloonvolgorde binnen een groep, geen enkele sessie die van licht naar zwaar loopt, zelf herordenen en terugzetten |
| `warmup.test.ts` | het warming-upblok: standaardwaarde, type en duur instellen, afvinken, meeschrijven met concept en afgeronde sessie, per gebruiker, en oude logs zonder blok |
| `unilateraal.test.ts` | de vlag `unilateral` op elke oefening: expliciet en compleet, "reps per zijde" alleen bij eenarmig of eenbenig werk, de uitlegregel erbij, en de ×2 in volume en duurschatting |
| `sessieNavigatie.test.ts` | navigeren binnen een sessie: vooruit en achteruit zonder rondlopen, springen vanaf de voortgangsbalk, een set van een afgeronde oefening bijstellen, en de afrondknop die alleen op de laatste oefening "Sessie afronden" zegt |
| `extraOefening.test.ts` | de extra oefening na een te makkelijke sessie: de gemeten sessieduur, elke voorwaarde die het aanbod tegenhoudt, twee makkelijke sessies op rij die het streefgewicht verhogen, en het opnieuw afronden zonder dubbele progressie |
| `hardloopopbouw.test.ts` | het rollend gemiddelde over vier weken werkelijk gelopen km, de eigen opbouwlijn van de duurloop (10 → 15 km, daarboven onderhoud), de contextregel onder de afstand, het meebewegende weekplafond (+0% tot +15%) en de blokkerende rem op drie stijgingen op rij |

`tests/setup.ts` zet een `localStorage`-vervanger neer, want de store leest die bij het
laden van de module.

## Deployen naar GitHub Pages

De app draait vanaf een submap op Pages, dus de base-path moet mee. Die komt uit de
env-variabele `VITE_BASE`.

**Optie 1 — automatisch via Actions.** `.github/workflows/deploy.yml` staat er al in.
Zet in de repo-instellingen *Settings → Pages → Source* op **GitHub Actions** en push
naar `main` (of `master`). De workflow zet `VITE_BASE` op `/<repo-naam>/` en publiceert
`dist/`.

De workflow draait `npm test` vóór `npm run build`. Faalt een test, dan stopt de
build-job daar en draait de deploy-job niet — die hangt er via `needs: build` aan. Er
komt dus nooit een versie online die de tests niet haalt.

**Optie 2 — handmatig.**

```bash
VITE_BASE=/trainingsapp/ npm run build
npx gh-pages -d dist          # of push dist/ naar de gh-pages branch
```

Vervang `trainingsapp` door de naam van je repository. Draait de app op een eigen
domein of in de root, dan kan `VITE_BASE` weg.

Na de eerste keer openen: in Chrome/Safari *Toevoegen aan beginscherm*. Daarna start
hij als losse app en werkt hij offline. Updates worden automatisch opgehaald
(`autoUpdate`) en zijn actief na het sluiten en heropenen van de app.

## Eén gebruiker per toestel

Bij de eerste start vraagt de app één ding: **wie je bent**. Die keuze bepaalt schema,
oefeningen, logs en instellingen, en wordt op het toestel onthouden. Daarna is het klaar:
in de onderbalk staan alleen nog Vandaag, Week, Voortgang en Instellingen. Wisselen van
profiel is geen dagelijkse handeling, dus het staat er niet.

Onderaan **Instellingen → Profiel** kan het toestel alsnog omgezet worden:

- **Ander profiel gebruiken** — zet om wie dit toestel gebruikt. Er wordt niets gewist: de
  gegevens van beide profielen blijven in `localStorage` staan en terugwisselen brengt
  alles terug zoals het was.
- **Meekijken met de ander** — klapt de voortgang van het andere profiel open: streak,
  afgelopen sessies en kilometers per week. Puur om te kijken: **loggen kan alleen voor
  jezelf.**

Progressie en gewichtsadvies worden altijd over precies één gebruiker berekend. Dat zit in
de vorm van de data: de logica krijgt een `UserState` en kan de ander domweg niet zien. De
enige actie die buiten je eigen gebruiker komt is "wie ben je".

## Hoe het schema werkt

### Rob — kracht + hardlopen

| Dag | Programma |
| --- | --- |
| ma | Benen A (zwaar) |
| di | Hardlopen kort + Duwen |
| wo | **Rustdag — hier plant de app nooit iets** |
| do | Hardlopen kort + Trekken |
| vr | Benen B (eenbenig/isolatie) |
| za | Bovenlichaam, optioneel (30-40 min) |
| zo | Duurloop |

Binnen een dag staat hardlopen altijd vóór krachttraining, met 10-15 min pauze ertussen.
Zaterdag overslaan telt niet als gemiste training en breekt de streak niet.

- **Deload:** elke achtste trainingsweek, en eerder als het nodig is — zie
  [Guardrails](#guardrails-de-app-remt-af). Een deloadweek houdt de structuur intact en
  haalt er 1 set per oefening, 40% van het gewicht en 30% van de kilometers af; de
  optionele zaterdag staat dan uit.
- **Kalibratie:** week 1 en 2 tonen geen streefgewicht maar "op gevoel, stop bij RIR 2-3".
  Vanaf week 3 neemt de progressielogica het over op basis van wat je gelogd hebt.
- **Rotatie:** na elke 3 volledige cycli (12 weken) schuift de oefeningselectie per
  bewegingspatroon door naar de volgende variant. Permanent vervangen oefeningen blijven staan.
- **Progressie:** alle sets op de bovengrens én de sessie beoordeeld als makkelijk of goed
  → gewicht omhoog naar het eerstvolgende gewicht dat te laden is, reps terug naar de
  ondergrens. Bij dumbbells groeit eerst het aantal reps door tot repMax + 2. Zwaar of de
  reps niet gehaald → gewicht blijft staan; twee sessies onder de ondergrens → −10%.
- **Bandwerk groeit door:** een mini-band houdt op bij de zwaarste band. Haal je daar het
  repsplafond, dan schuift de app de oefening door naar de belaste variant — staande
  heupabductie aan de kabel met enkelmanchet — en loopt de progressie daar in kilo's verder.
  In reismodus blijft het bandwerk staan; een kabeltoren gaat niet mee in de koffer.
- **Hardloopvolume:** 22 km in week 1 (6 + 6 + 10), daarna 5% opbouw per week, met een hard
  plafond van +10% boven het gemiddelde van de twee voorgaande weken.

### Anouc — full body + hardlopen

| Dag | Programma |
| --- | --- |
| ma | **Rustdag** |
| di | Hardlopen |
| wo | Full body A |
| do | Vrij |
| vr | Hardlopen |
| za | Full body B |
| zo | Duurloop |

Twee krachtsessies per week van 45-60 min, zelfde thuisgym en zelfde uitleg per oefening
als het andere schema. Het hardlopen dat er al was verandert niet: de app schrijft geen
afstanden voor op die dagen en registreert alleen wat er gelopen is.

Beginnend niveau, dus twee dingen anders dan bij Rob:

- **Lager startpunt** — het geadviseerde startgewicht gaat maal 0,7.
- **Rustiger opbouw** — elke oefening klimt eerst in herhalingen door tot boven de
  bovengrens; pas daarna komt er gewicht bij. Waar Rob na één goede sessie een schijf
  erbij krijgt, groeit hier eerst het aantal reps.

De oefeningkeuze houdt rekening met het materiaal: duw- en schouderwerk loopt via kabel
(chest press, laag roeien, pull-through), band (overhead press, abductie) of
lichaamsgewicht (glute bridge, step-up, kuitheffing, dead bug). Leg press en smith laten
zich vanaf de laagste stand belasten. Sinds er dumbbells van 5 kg liggen is licht
dumbbellwerk ook hier een reële optie: het startgewichtadvies pakt die stap vanzelf. De
sjablonen blijven staan zoals ze zijn, zodat een lopend schema niet onder je voeten
verandert.

## Guardrails: de app remt af

Deze laag heeft één taak: voorkomen dat je uit jezelf te hard of te zwaar gaat. De regels
zijn deterministisch — ze rekenen alleen met wat er gelogd is en met de kalender, en er zit
geen advies of voorspelling in. Elke bijsturing is zichtbaar en komt met één regel waarom,
en elk voorstel is te overschrijven; die afwijking wordt dan vastgelegd.

### Gevoelsregistratie

- **Per sessie** (kracht én hardlopen) een afsluitende beoordeling: **makkelijk / goed /
  zwaar**. Die drie knoppen ronden de sessie meteen af — één tik. Overslaan mag; dan valt
  de progressie terug op de RIR die je per set gelogd hebt.
- **Per dag** een optionele dagcheck: slaap en energie, allebei op een schaal van 3
  (slecht / oké / goed). Niet invullen heeft geen enkel gevolg.

### Progressie (`src/logic/progression.ts`)

- **Double progression** — alle sets op de bovengrens van de rep-range én de sessie als
  makkelijk of goed beoordeeld: het gewicht mag omhoog. Zwaar, of de reps niet gehaald:
  het gewicht blijft staan.
- **Maximaal 2,5 kg per week** op samengesteld werk en **1,25 kg** op isolatie, per
  oefening. Meerdere goede sessies in dezelfde week leveren niet meer op dan één.
- **Alleen wat te laden is** — het voorstel wordt afgerond op het stanggewicht plus de
  schijven die er liggen (`src/logic/plates.ts`, instelbaar per gebruiker). Schijven gaan
  per paar, dus met 1,25 kg als lichtste schijf is 2,5 kg de kleinste stap. Past de
  kleinste stap niet binnen de weekgrens — een dumbbellrek dat van 5 naar 12,5 kg springt,
  of isolatie op een machine met een stap van 2,5 kg — dan wordt hij uitgesmeerd: hij mag
  pas als er genoeg weken tussen zitten om gemiddeld onder de grens te blijven, en tot die
  tijd komen er reps bij. Zonder die uitsmering zou zo'n oefening nooit meer zwaarder
  kunnen worden, en dat is geen rem maar een muur.
- **Twee sessies op rij onder de ondergrens** → streefgewicht 10% omlaag, afgerond naar
  beneden op wat te laden is.

### Hardloopvolume (`src/logic/runningLoad.ts`)

De weekkilometers komen uit wat er **werkelijk gelopen** is, losse rondjes hardlopen
inbegrepen: anders zou de bewaking te omzeilen zijn door buiten het schema om te loggen.

- **Plafond** — nooit meer dan 10% boven het gemiddelde van de twee voorgaande weken. Twee
  weken, niet één: dan trekt één week met een gemiste loop het schema niet onderuit. Een
  week zonder enige gelogde loop telt als "niets ingevuld" en valt terug op het plan.
- **Verder gelopen dan gepland** — dat eet van het weekplafond, dus de lopen die er die
  week nog staan schuiven naar beneden, met de reden erbij.
- **Zwaar beoordeeld** — een als zwaar beoordeelde loop haalt de rest van de week 10% omlaag.
- **Verdeling** — de duurloop krijgt zijn aandeel als eerste en houdt wat er overblijft; de
  korte lopen krijgen de rest, binnen 5 tot 8 km. Die volgorde is het hele punt: andersom
  (korte lopen eerst op hun ondergrens, duurloop als restpost) kon een teruggeschaalde week
  een zondag van 6 km opleveren met dinsdag en donderdag op 5 — dat was de bug.
- **Zware benen vlak voor de duurloop** — zie hieronder; die regel telt de werkelijke
  beenbelasting van de sessie, niet de naam ervan.

### Zware benen vlak voor de duurloop (`src/logic/legLoad.ts`)

Deze regel keek eerst naar de naam van de sessie — "benen A" en "benen B" waren zwaar, de
rest niet. Dat klopte voor één programma en voor geen enkel ander, en de harde grens van
48 uur maakte de standaardweek per toeval stil. Nu wordt geteld wat er echt gepland staat:

- **Wat voor werk** — zwaar samengesteld beenwerk (squat, leg press, RDL, lunges, hip
  thrust) telt vol mee, beenisolatie (leg curl, leg extension, kuiten, abductie) voor 0,3
  per set, bovenlichaam en romp niet.
- **Hoeveel werksets**, ná alles wat de dag er al af haalt: de korte versie, een lage
  check-in en de deloadweek.
- **Hoe zwaar** — welk deel van je hoogst geschatte 1RM er gepland staat. Zonder historie
  telt 0,7; werk op lichaamsgewicht of band 0,4, want daar staan geen kilo's tegenover.

Boven de 3 heet dat zwaar, boven de 6 heel zwaar. Ter ijking: benen A komt op ~9, een full
body met één matige beenoefening op ~2,8 — die laatste levert dus geen melding op.

Het tijdvenster is een oplopende schaal in plaats van een harde grens, met de
grenswaarden bij de strengere band zodat 24 en 48 uur voorspelbaar afgehandeld worden:

| Uren tot de duurloop | Melden bij |
| --- | --- |
| tot en met 24 | zwaar (≥ 3) |
| 24 tot en met 48 | heel zwaar (≥ 6) |
| meer dan 48 | nooit |

**Herhaling wordt gedempt.** Staat dezelfde combinatie er de twee weken ervoor ook, dan is
het de opzet van de week en geen incident. Dan komt er één structurele signalering in
plaats van elke week hetzelfde regeltje, met een knop om de sessie meteen te verplaatsen.
Weggeklikt blijft hij vier weken stil; verandert het patroon eerder — een andere dag, een
andere sessie, een ander niveau — dan is het een andere melding en staat hij er weer. De
sleutel ís het patroon, dus dat werkt vanzelf.

De melding noemt de sessie, het aantal uren en de oefeningen die de belasting veroorzaken:
"Full body B op za 15 aug staat 24 uur voor de duurloop van zo 16 aug — Smith squat, Kabel
pull-through en Step-up doen het meeste werk."

### Deload (`src/logic/deload.ts`)

Aanleiding — drie sessies als zwaar beoordeeld binnen twee weken, twee weken op rij een
overwegend slechte dagcheck, of simpelweg elke achtste trainingsweek. De reactieve
triggers kijken alleen naar wat er vóór deze week gebeurde: het schema verandert niet
onder je voeten terwijl je er in staat.

Overslaan kan, maar niet met één tik: eerst het risico lezen en aanvinken, dan pas de knop.
De bevestigde tekst wordt bewaard, zodat achteraf duidelijk is wat er stond.

### Sessieduur (`src/logic/duration.ts`)

De app schat de duur uit sets, reps en rusttijden, plus de warming-up. Boven het uur komt
er een waarschuwing met een concreet voorstel: welk accessoire eruit kan, en wat de sessie
dan duurt. Kernoefeningen worden nooit voorgesteld om te schrappen.

### Zichtbaar en overschrijfbaar

Elke bijsturing staat als losse regel op Vandaag, in de sessie en op de weekpagina — "Deze
week al 14 km gelopen van de 22 — resterende lopen teruggeschaald naar 4 km". Wat je zelf
anders doet komt in `deviations` te staan en is terug te lezen op Voortgang: een zelf
gezette loopafstand, verder lopen dan gepland, zwaarder tillen dan voorgesteld en een
overgeslagen deload. De app stuurt daar niets mee bij; het is er om later een patroon uit
te kunnen lezen.

## Materiaal

De thuisgym: smith, leg press, leg curl/extension-combimachine, lat toren, lage kabel,
bank, optrekstang, trap bar, olympische stang, deadliftstang, curlstang, schijven,
kettlebell, schouderzak, ab roller, spinningfiets, loopband en lange weerstandsbanden.

Daar kwam bij:

- **Mini-loopbands** — een set met oplopende weerstand (geel, rood, groen, blauw, zwart).
  Al het mini-bandwerk logt op **niveau**, niet op kilo's; zie hieronder.
- **Enkelmanchet voor de lage kabel** — maakt staande heupabductie aan de kabel mogelijk.
  Dat is de enige abductie met echte gewichtsprogressie en daarmee het eindstation van
  het bandwerk.
- **Dumbbells van 5 kg** — naast de 12,5 / 15 / 17,5 / 20 kg die er al lagen. Het rek staat
  in `src/logic/dumbbell.ts`; het advies rondt daarnaartoe af, altijd naar beneden. Valt een
  schatting tussen 5 en 12,5, dan wordt het de 5 kg — te licht beginnen mag, te zwaar niet.
  Onder de lichtste dumbbell geeft de app geen advies in plaats van een verzonnen getal.

### Gluteus medius

De zijkant van de heup staat bij Rob standaard op **let op**, en daar hoort opbouwen vanaf
de laagste weerstand bij. Beide beensessies hebben daarom twee lagen glute medius-werk: een
staande of lopende mini-bandoefening die doorgroeit naar de kabel, en vloeractivatie op de
lichtste band. In de bibliotheek staan clamshell, zijligging beenheffen (met en zonder
band), monster walk, laterale bandwalk, staande abductie met mini-band en de staande
heupabductie aan de kabel — allemaal met patroon `abduction` en de belastingstag
`lateral_hip`, dus ze zijn onderling uitwisselbaar via *wissel* en de 12-weekse rotatie.

## Vaste volgorde binnen een sessie

Elke krachtsessie ziet er hetzelfde uit: eerst warm worden, daarna van zwaar naar licht.

**Warming-up.** Bovenaan het sessiescherm staat een blok met 5-10 min **loopband** of
**losfietsen** (spinningfiets). Het type is te kiezen, de duur instelbaar en het blok is
af te vinken, net als een oefening. De keuze hoort bij die ene sessie en wordt met het
sessielog meegeschreven, dus hij staat er na een herlaadbeurt nog. Het
sessieoverzicht op Vandaag begint er ook mee.

**Daarna de oefeningen, in deze volgorde:**

1. de zwaarste samengestelde beenoefening — squat, leg press, deadlift/RDL
2. overig samengesteld werk — bankdrukken, roeien, lat pulldown, overhead press
3. isolatie — leg extension, leg curl, biceps, kuiten
4. romp, als afsluiter — ab roller, plank

De reden staat in de app achter het `?` bij *Volgorde*: zwaar en technisch werk vóór licht
en vermoeiend werk. Zo gaat je beste energie naar de oefeningen die je progressie bepalen
en train je de technische bewegingen niet met een vermoeide romp — dat scheelt
blessurerisico.

De rangorde zit als veld **`orderCategory`** op de oefening zelf (`src/data/exercises.ts`),
niet als lijstje in de UI. Een nieuwe oefening in de bibliotheek valt daardoor vanzelf op
zijn plek, en TypeScript weigert een oefening zonder categorie. Binnen dezelfde categorie
blijft de volgorde van het sjabloon staan.

**Het is de standaard, geen slot.** Onder `⋯` bij een oefening staan *↑ Eerder* en
*↓ Later*; zodra je zelf schuift, legt de app de volgorde van die dag vast (`order` in de
dagoverride) en houdt zich daaraan. *Standaardvolgorde* zet hem weer terug. Overslaan van
een oefening werkt zoals het werkte: de rest schuift gewoon door.

## Uitleg en poppetjes

Elke oefening heeft een korte uitleg in het Nederlands: **Start** (stand, greep,
machine-instelling), **Uitvoering** (2-3 punten inclusief tempo) en **Fout** (de meest
gemaakte fout). Die staat achter het `?`-knopje in het sessiescherm en is standaard dicht,
ook de eerste keer dat een oefening voorkomt.

Samengestelde oefeningen krijgen daarboven twee poppetjes: **start** en **eind**. Die
worden getekend door `<Figure />` uit gewrichtshoeken — enkel, knie, heup, romp, schouder,
elleboog en nek, links en rechts apart waar dat uitmaakt — met vaste ledemaatlengtes,
een vloerlijn en het materiaal als simpele lijnen (stang, dumbbell, machine-omtrek, bank,
kabel). Isolatie-, band-, kabel- en rompoefeningen krijgen alleen tekst; het veld
`hasFigure` legt dat per oefening vast.

De hoeken staan in `src/data/figures.ts`. Ze zijn geschreven als segmentrichtingen en
omgerekend naar gewrichtshoeken; een test controleert dat elk lichaamspunt binnen het
kader en boven de vloer blijft.

## Startgewichtadvies

Bij een oefening waar nog niets van gelogd is, staat er een geschat gewicht als grijze
waarde **in** het invoerveld. Overschrijven kan altijd, en het getal dat je logt is
leidend — ook als het ver van de schatting ligt.

De schatting komt van:

1. de verhouding tot de oefening met de meest vergelijkbare **belastingsvorm**, zodra daar
   data van is (`relatedRatio`);
2. anders lichaamsgewicht × `startFactor`;
3. zonder ingevuld lichaamsgewicht: geen advies.

"Meest vergelijkbare belastingsvorm" betekent hetzelfde apparaat, of anders dezelfde soort
weerstand: schijven, stang, dumbbells per hand, kabel, kettlebell of schouderzak. Het
bewegingspatroon speelt geen rol — de eenbenige leg press hangt aan de gewone leg press
(×0,5, halve belasting per been), niet aan een split squat met dumbbells.

De verwijzingen vormen een boom per weerstandssoort met acht ankers: `leg_press`,
`smith_squat`, `rdl_barbell`, `curl_bar_curl`, `flat_db_press`, `lat_pulldown`,
`goblet_squat_kb` en `sandbag_squat`. Die hebben zelf geen verwijzing en vallen terug op
het lichaamsgewicht. Er zitten dus geen kringetjes in; een test bewaakt dat.

De advieslogica loopt de keten af tot een oefening waar wél data van is en vermenigvuldigt
de ratio's onderweg. Heeft alleen het anker data, dan telt dus het hele pad mee: een leg
curl zonder historie komt via leg extension (×0,8) en leg press (×0,35) uit op 0,28 × je
gelogde leg press. Afronden gebeurt één keer, aan het eind. Pas als de hele keten leeg is,
valt het advies terug op lichaamsgewicht × `startFactor`.

Alles wordt naar beneden afgerond op de kleinste stap van dat apparaat, en de factoren
staan bewust laag. Te licht beginnen kost een week; te zwaar beginnen kost een blessure.
Zodra er één set gelogd is, verdwijnt het advies definitief en neemt de progressielogica
het over. Wijzigt je lichaamsgewicht in Instellingen, dan schuiven alleen nog niet gelogde
adviezen mee; bestaande historie blijft ongemoeid.

## Gewicht invoeren

Wat je in het kg-veld zet, hangt af van het materiaal. Het veld zegt het er zelf bij.

- **Stang** (smith, trap bar, olympische stang, deadliftstang, curlstang): je vult alleen
  de **schijven** in. De app telt het eigen gewicht van de stang erbij en zet het totaal
  eronder: *40 kg totaal — 20 kg stang + 20 kg schijven*. De stanggewichten staan bij
  Instellingen → Stanggewicht en zijn per gebruiker aan te passen; elke sportschool heeft
  andere stangen, vooral bij de smith. In de log staat altijd het totaal, dus progressie,
  1RM en startgewichtadvies rekenen ongewijzigd door.
- **Dumbbells**: het gewicht is **per dumbbell**, niet het totaal van twee. Twee van 12,5
  kg log je als 12,5. Reps tel je **per zijde**: 10 links en 10 rechts tegelijk is 10 reps,
  niet 20. Bij eenzijdige oefeningen staat het er expliciet bij ("reps per zijde").
  Intern telt een tweezijdige dumbbell-oefening dubbel — je tilt er immers twee — en bij
  eenzijdig werk tellen beide kanten. Zo levert 12,5 kg × 10 reps hetzelfde volume op of je
  nu twee dumbbells tegelijk tilt of één per kant. Die regels staan in
  `src/logic/dumbbell.ts` en worden vandaaruit overal toegepast: labels, volume en advies.
- **Mini-band**: geen kilo's maar een **niveau**, 1 (geel, lichtst) tot 5 (zwart, zwaarst).
  Een band heeft geen gewicht dat je kunt loggen, en een verzonnen getal zou in het
  tilvolume en het geschatte 1RM terechtkomen. Bandwerk telt daarom niet mee in beide;
  je voortgang zie je aan het niveau en de reps. De progressie loopt in twee trappen: eerst
  reps erbij tot bovengrens + 2, dan de volgende band en terug naar de ondergrens. Twee
  sessies onder de ondergrens gaat een band terug, en in een deloadweek pak je er één
  lichter. De niveaus staan in `src/logic/band.ts`.
- **Machines en kabels**: gewoon wat er op de pin of de stapel staat.

Op Voortgang staat naast het loopvolume ook het **tilvolume per week** (gewicht × reps over
alle sets), berekend met dezelfde conventie.

## Aanpassen tijdens de rit

- **Ochtend-check-in** (1-5, optioneel): 4-5 normaal · 3 geen nieuwe gewichtsverhogingen ·
  1-2 automatisch afschalen (loop −30% of fietsen, 1 set minder, zwaar kuitwerk eruit,
  zaterdag uit). Los daarvan staat de **dagcheck** (slaap en energie, schaal van 3): die
  stuurt de dag van vandaag niet, maar telt mee in de deloadbeslissing.
- **Na afloop:** elke sessie — kracht én loop — sluit je af met makkelijk, goed of zwaar.
  Bij een loop leg je daar ook de werkelijk gelopen afstand vast, voorgevuld met wat er
  gepland stond, plus eventueel de tijd; gepland en werkelijk blijven apart bewaard.
- **Geplande loopafstand:** het voorstel van de app is aan te passen per loop, en weer los
  te laten. Wat je zelf kiest wint, ook van de +10%-bewaking.
- **Per sessie:** korte versie (alleen `core`-oefeningen, ~25 min), verplaatsen naar een
  andere dag, overslaan met reden. Een loop kan daarnaast vervangen worden door 30 min
  fietsen — dat telt als voltooid.
- **Verplaatsen:** kracht én loop kunnen naar een andere dag, onafhankelijk van elkaar. Op
  Vandaag zit de knop bij de sessie zelf; op de weekpagina heeft elke regel zijn eigen knop
  — *Open* bij de krachtsessie, *Verplaatsen* bij de loop — zodat ook een loop van morgen of
  overmorgen te verzetten is. Op een dag met allebei verzet je dus alleen wat je wilt
  verzetten.

  De lijst loopt **beide kanten op**: van de dag vóór deze week tot en met de dag erna, dus
  een sessie is net zo goed naar voren te halen en over een weekgrens heen te verzetten.
  Is de doeldag bezet met hetzelfde soort sessie, dan ruilen de twee van plek (ma ↔ vr
  bijvoorbeeld); dagen die al aan een verplaatsing meedoen vallen af, want ketens maken het
  onnavolgbaar. Woensdag staat in de lijst maar is geblokkeerd (bij Anouc maandag): de vaste
  rustdag is nooit een geldige bestemming.

  **De guardrails gelden op de nieuwe datum.** Per dag staat er bij wat die keuze oplevert:
  zwaar beenwerk dat te dicht op de duurloop komt, twee zware beendagen achter elkaar, of
  een week die over het loopplafond gaat. Dat houdt je niet tegen — je ziet het vooraf en
  kiest zelf. Alleen conflicten die er zónder deze verplaatsing ook al waren blijven
  ongenoemd; die horen niet bij deze keuze.
- **Per oefening:** eenmalig wisselen, permanent vervangen (rouleert dan niet meer mee),
  een plek naar voren of naar achteren schuiven, of overslaan.
- **Gevoelige gebieden** (Instellingen): per belast gebied ok / let op / gevoelig. Op
  *gevoelig* filtert de app alle oefeningen met dat label eruit en kiest een alternatief
  uit hetzelfde patroon. `lateral_hip` staat standaard op *let op*.
- **Reismodus:** alles naar lichaamsgewicht + band, max 30 min. Loopdagen ongewijzigd,
  de cyclus loopt door.

## Losse activiteiten

Naast het schema kun je elke dag **losse activiteiten** loggen: 's ochtends gepland
hardgelopen en 's avonds nog rustig gefietst, een wandeling, een keer zwemmen. De knop
*Activiteit toevoegen* staat elke dag op Vandaag — ook op een rustdag, ook als de geplande
sessie al afgerond is, en meerdere keren per dag.

De invoer blijft licht: type (fietsen, wandelen, zwemmen, hardlopen, spinning, overig),
duur in minuten, intensiteit (rustig / normaal / intensief) en een optionele notitie. Geen
sets of reps. Bij hardlopen, fietsen en wandelen staat er ook een **afstand in km**; de app
zet het gemiddelde tempo erbij — min/km bij lopen en wandelen, km/u bij fietsen. Zwemmen,
spinning en overig blijven op tijd, want daar zegt een afstand niets. In het formulier staat ook de datum, dus achteraf invullen op een eerdere dag
kan. Bewerken en verwijderen gaat via dezelfde weg: tik op *Bewerk* bij de activiteit, op
Vandaag of in de historie onder Voortgang.

Ze staan overal apart van het schema, met het label **Extra**, zodat zichtbaar blijft wat
gepland was en wat erbij kwam. Belangrijk: ze zijn puur registratie. Ze tellen niet mee in
de krachtprogressie, het gewichtsadvies, de 1RM-grafiek of het hardloopvolume, en ze
veranderen niets aan het schema of de rustdaglogica.

## Waar de data staat

**Alles staat lokaal, in `localStorage` onder de sleutel `trainingsapp.state.v1`.** Er
gaat niets naar internet: geen account, geen server, geen sync. Elk toestel houdt dus zijn
eigen gebruikers en zijn eigen historie bij, en de app werkt overal offline.

Dat betekent ook: **export is de enige manier om data tussen toestellen te verplaatsen**,
en de enige back-up.

- **Exporteer alles** geeft een JSON met beide gebruikers, hun instellingen en de volledige
  historie.
- **Importeer** leest zo'n bestand terug en vervangt daarmee wat er op dat toestel staat.
  Een oudere export wordt onderweg opgehoogd naar de huidige `schemaVersion`, dus een
  back-up van maanden geleden werkt gewoon.
- Zodra er data is, herinnert het instellingenscherm je eraan zodra de laatste export
  ouder is dan 30 dagen (of er nog nooit een was). Zonder export ben je bij het wissen van
  je browserdata alles kwijt.

### Gegevens wissen

Wissen is de enige actie die niet terug te draaien is en staat daarom apart onderaan
Instellingen, in een dichtgeklapte sectie **Gegevensbeheer**.

- **Pincode** — vier cijfers, in te stellen en te wijzigen in diezelfde sectie (wijzigen
  vraagt de oude code en de nieuwe twee keer). Zonder ingestelde code kan er niets gewist
  worden; de eerste keer dat je op de wisknop tikt vraagt de app er een in te stellen. Dit
  is **misklikbeveiliging, geen echte beveiliging**: de code staat leesbaar in
  `localStorage`, net als de rest van de gegevens. Hij is er tegen een verdwaalde tik, niet
  tegen iemand die je telefoon in handen heeft.
- **De dialoog** toont eerst wat er verdwijnt: aantal gelogde krachtsessies,
  hardloopsessies en losse activiteiten, en de datum van de oudste log. Is er nooit
  geëxporteerd of is de laatste export ouder dan 7 dagen, dan staat er bovenaan een
  waarschuwing met een knop **Eerst exporteren** die de download meteen start.
- **De bevestigknop blijft uit** tot de juiste pincode ingevuld is. Na drie foute codes
  sluit de dialoog en is wissen 60 seconden geblokkeerd; die blokkade zit op moduleniveau
  (`src/logic/wipeGuard.ts`), dus opnieuw openen helpt niet.
- **Alleen het actieve profiel** wordt gewist, tenzij je in de dialoog aanvinkt dat het
  andere profiel ook mee moet. Na afloop staat het toestel weer op de eerste-start-keuze
  in plaats van op een leeg scherm. De pincode blijft staan: die hoort bij het toestel.

Er was tot v8 een Firestore-sync per huishoudcode. Die is eruit, inclusief de
firebase-dependency, de web-config en `firestore.rules`; migratie v8 → v9 ruimt de
huishoudcode en de synctijdstempels op uit bestaande data. Het Firebase-project
`trainingsapp-c87cf` wordt door deze app niet meer gebruikt en kan in de console weg.

### Versiebeheer van het formaat

De opgeslagen staat heeft een `schemaVersion` (nu **12**). Bij het laden en bij een import:

- **ouder dan de huidige versie** → de stappen in `src/store/migrations.ts` hogen de data op.
  Niets wordt geweigerd of gewist.
- **gelijk** → ongewijzigd overgenomen.
- **nieuwer** → import wordt geweigerd met de melding dat de app eerst bijgewerkt moet worden.
- **kapot, leeg of zonder `schemaVersion`** → aangevuld met de standaardwaarden; de app
  start altijd.

Een nieuwe versie toevoegen: verhoog `SCHEMA_VERSION` in `src/store/store.ts` en zet de
stap van de oude naar de nieuwe versie in `MIGRATIONS` in `src/store/migrations.ts`. De
sleutelnaam in `localStorage` blijft gelijk; het `v1`-achtervoegsel daarin is historisch.

Bestaande stappen:

- **v1 → v2** — sessielogs kregen een `exercises`-map (slotKey → exerciseId), zodat de
  voortgangsgrafiek weet welke oefening er echt gedaan is. Oude logs worden aangevuld met
  de standaardoefening van dat slot.
- **v2 → v3** — gelogde sets worden genormaliseerd: waarden die geen getal zijn worden 0,
  en volledig lege sets uit afgeronde sessies vervallen. Het startgewichtadvies leest
  gelogde gewichten terug, dus die moeten betrouwbaar numeriek zijn. Lopende concepten
  blijven ongemoeid.
- **v3 → v4** — sets kregen een expliciete `done`-vlag en sessies een `completedSlots`-lijst.
  Voorheen gold "reps ingevuld" als gelogd, dus oude sets met reps > 0 worden afgevinkt.
- **v5 → v6** — meerdere gebruikers. Tot en met v5 was de opgeslagen staat één platte
  gebruiker, en die was van Rob: hij verhuist ongewijzigd naar `users.rob` en het toestel
  staat meteen op Rob, zodat er na de update niets verandert aan wat je ziet. Anouc komt
  er leeg bij.
- **v4 → v5** — losse activiteiten naast het schema. Oude data kent die lijst nog niet en
  krijgt een lege; bestaande sessies, loops en oefeningstanden blijven ongemoeid.
  Activiteiten uit een handgeschreven bestand worden gerepareerd: een onbekend type wordt
  `overig`, een onleesbare duur 0, en records zonder `id` vervallen.
- **v6 → v7** — drie toevoegingen per gebruiker: de instelbare stanggewichten (standaard
  trap bar 20, smith 15, olympische stang 20, deadliftstang 20, curlstang 7,5), een
  `distanceKm` bij losse activiteiten (bestaande krijgen `null`) en een eigen `runMoves`
  voor verplaatste loopsessies. Gelogde gewichten blijven ongemoeid: daar stond en staat
  het totaal in.
- **v7 → v8** — de instellingen van elke gebruiker worden compleet gemaakt. Ontbrekende
  gevoelige gebieden, stanggewichten, onderhoudsitems, reismodus of eiwitfactor krijgen de
  standaard; wat er al stond blijft staan. Dit repareert data die langs de sync of een
  handgeschreven bestand binnenkwam: een `settings` zonder die velden liet het
  instellingenscherm vastlopen, en daarmee bleef er een zwart scherm over.
- **v8 → v9** — de Firestore-sync is eruit. Wat daarvan in de data achterbleef wordt
  opgeruimd: de gedeelde huishoudcode bovenin en per gebruiker de tijdstempels waarmee
  twee toestellen bepaalden wie won (`updatedAt`, en het Firestore-veld `bijgewerkt`).
  Sessies, loops, activiteiten, instellingen, wie je bent en welke gebruikers er zijn
  blijven onaangeroerd.
- **v9 → v10** — één veld erbij: `pin`, de viercijferige code voor het wissen van
  gegevens. Bestaande data krijgt `null`, en dan is wissen simpelweg niet mogelijk tot er
  in de instellingen een code is ingesteld. Verder verandert er niets.
- **v11 → v12** — één veld erbij per gebruiker: `dismissedWarnings`, een sleutel per
  weggeklikt patroon met de datum erbij. Bestaande data krijgt een lege lijst; er is dan
  simpelweg nog niets weggeklikt.
- **v10 → v11** — de guardrails-laag. Per gebruiker komen er vier lege velden bij:
  `dayChecks` (de optionele dagcheck), `runPlans` (een zelf gezette loopafstand per dag),
  `deloadSkips` (bewust overgeslagen deloadweken) en `deviations` (afwijkingen van
  voorstellen). De instellingen krijgen er `plates` bij, de schijven die er liggen. De
  beoordeling van een sessie (`feel`, op het sessielog én op het looplog) heeft geen stap
  nodig: hij is optioneel en ontbreekt gewoon bij alles wat er al stond — precies zoals de
  progressie hem leest, want zonder beoordeling telt de gelogde RIR.

Niet elke toevoeging heeft een stap nodig. Het warming-upblok (`warmup` op het sessielog)
en de eigen oefeningvolgorde (`order` op de dagoverride) zijn allebei optioneel: ontbreken
ze, dan vult de app het standaardblok en de automatische volgorde in. Oude data heeft er
dus niets voor nodig en `schemaVersion` blijft daarvoor gelijk.

Instellingen die van buiten binnenkomen gaan altijd door `normalizeSettings`
(`src/store/settings.ts`): bij het laden én bij een import. Een export van vóór de
gevoelige gebieden of de stanggewichten kan zo geen half instellingenobject achterlaten
waar de schermen op vastlopen; wat ontbreekt krijgt de standaard, wat er staat blijft.

## Structuur

```
src/
  data/exercises.ts   oefeningenbibliotheek (min. 6 per bewegingspatroon)
  data/coaching.ts    uitleg per oefening: start, uitvoering, fout
  data/figures.ts     hoekensets en materiaal voor de poppetjes
  data/startWeights.ts startFactor en relatedRatio per oefening
  data/plan.ts        weekstructuur en de sessiesjablonen
  logic/cycle.ts      weeknummer, cyclusweek, deload, kalibratie, rotatie
  logic/select.ts     welke oefening je vandaag krijgt (rotatie, gevoelig, reismodus, wissels)
  logic/day.ts        wat er vandaag te doen is
  logic/order.ts      de vaste volgorde binnen een sessie, en zelf herordenen
  logic/warmup.ts     het warming-upblok waar elke krachtsessie mee begint
  logic/progression.ts streefwaarden, double progression en de maximale sprong per week
  logic/plates.ts     afronden op wat er echt te laden is: schijven, stang, dumbbellrek
  logic/running.ts    de kale rekenkunde van het loopschema: opbouw en verdeling
  logic/runningLoad.ts loopvolume met de rem erop: weekplafond, deload, gevoel
  logic/deload.ts     wanneer een deloadweek nodig is, en wat er dan af gaat
  logic/duration.ts   geschatte sessieduur en de waarschuwing boven het uur
  logic/guardrails.ts alle bijsturingen van een dag, met per stuk één regel waarom
  logic/legLoad.ts    hoe zwaar een sessie op je benen is, geteld uit de oefeningen
  logic/sessionSlots.ts welke oefeningen er in de sessie van een dag zitten
  logic/schedule.ts   wat er volgens het schema op een dag staat, verplaatsingen meegerekend
  logic/feel.ts       beoordeling per sessie en de dagcheck
  logic/startWeight.ts geschat startgewicht zonder historie
  logic/stats.ts      streaks, 1RM-verloop, weekvolume
  logic/activities.ts losse activiteiten naast het schema
  logic/barWeight.ts  stanggewicht: schijven invullen, totaal opslaan
  logic/dumbbell.ts   de dumbbell-conventie en het dumbbellrek op één plek
  logic/band.ts       bandniveaus: kleuren, grenzen en labels
  logic/wipeGuard.ts  pincode en pogingenteller voor het wissen
  logic/load.ts       hoe de belasting boven een invoerveld heet
  data/programs.ts    de twee programma's: week, sjablonen, looptype, tempo
  store/store.ts      localStorage-store, export/import
  store/settings.ts   standaardinstellingen en het heel maken van halve settings
  store/migrations.ts migratiepad tussen schemaVersions
  store/actions.ts    alle mutaties
  components/ErrorBoundary.tsx  vangnet per scherm: melding en terug naar Vandaag
  components/Figure.tsx  poppetje uit gewrichtshoeken, met materiaal en vloer
  components/Activities.tsx  invoer en weergave van losse activiteiten
  components/MoveSheet.tsx   dagkeuze bij verplaatsen, gedeeld door Vandaag en Week
  screens/            Welkom, Vandaag, Sessie, Week, Voortgang, Meekijken, Instellingen
                      (Meekijken zit onder Instellingen → Profiel, niet in de onderbalk)
tests/                vitest-suite, draait zonder browser
```
