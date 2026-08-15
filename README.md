# Trainingsschema

PWA voor twee gebruikers, elk met een eigen trainingsschema, gedeeld binnen één
huishouden. Offline-first, installeerbaar, donker thema. Geen accounts en geen
wachtwoorden: een gedeelde huishoudcode koppelt de toestellen, Firestore synct en
`localStorage` is de offline cache.

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
| `cycle.test.ts` | weeknummer, cyclusweek, deload, kalibratie, rotatie na 3 cycli |
| `day.test.ts` | weekstructuur, woensdag altijd leeg, deload, check-in-afschaling, korte versie, gevoelige gebieden, reismodus, verplaatsen/ruilen, zaterdagblokkade voor beensessies |
| `running.test.ts` | volumeverdeling, de +10%-grens en het terugschalen |
| `progression.test.ts` | streefwaarden, progressie op gewicht en op reps, de −5%-regel |
| `stats.test.ts` | streaks, 1RM-reeks, eiwitdoel, exportherinnering |
| `coaching.test.ts` | elke oefening heeft een gevulde setup, execution en mistake |
| `figure.test.tsx` | elke oefening met `hasFigure` heeft twee complete hoekensets die binnen beeld blijven en foutloos renderen |
| `startWeight.test.ts` | startgewichtadvies: met en zonder lichaamsgewicht, met en zonder vergelijkbare data, afronding, verdwijnen na de eerste set, en de verwijzingen bestaan en zijn niet circulair |
| `store.test.ts` | export/import-roundtrip, afwijzen van onzin en van nieuwere versies, migratie van oudere `schemaVersion` |
| `screens.test.tsx` | elk scherm rendert (server-side, vangt render-fouten) |
| `users.test.ts` | twee gebruikers: eigen schema, eigen logs en instellingen, en de bevestiging dat progressie, gewichtsadvies, 1RM en weekvolume strikt per gebruiker blijven; plus het full body-schema van Anouc (dagen, duur, materiaal, rustiger opbouw, lichter startpunt) |
| `sync.test.ts` | offline loggen en later syncen, bundelen per gebruiker, botsingen op tijdstempel, half-kapotte documenten, en de migratie van bestaande localStorage-data naar gebruiker Rob |
| `activities.test.tsx` | losse activiteiten: toevoegen (ook op een rustdag en een eerdere datum), bewerken, verwijderen, afstand en gemiddeld tempo, migratie v4 → v5, en de bevestiging dat ze de krachtprogressie, 1RM-grafiek en loopvolume niet raken |
| `setRow.test.tsx` | de invoervelden in een setrij: minimumbreedte, 16px tekst, vaste knopbreedte en wrappen in plaats van samenknijpen — voor elke setrij van elke sessie |
| `barWeight.test.ts` | welke oefening een stang gebruikt, het instelbare stanggewicht, schijven ↔ totaal en de migratie naar v7 |
| `dumbbell.test.ts` | de dumbbell-conventie: gewicht per dumbbell, reps per zijde, de interne ×2 in volume en advies, en de labels in de UI |
| `moveRun.test.tsx` | loopsessies verplaatsen: ruilen, ongedaan maken, geen ketens, los van de krachtsessie, de knop per loopregel op de weekpagina, en de scheiding per gebruiker over een herlaadbeurt heen |
| `order.test.ts` | de vaste volgorde: `orderCategory` op elke oefening, sorteren en de sjabloonvolgorde binnen een groep, geen enkele sessie die van licht naar zwaar loopt, zelf herordenen en terugzetten |
| `warmup.test.ts` | het warming-upblok: standaardwaarde, type en duur instellen, afvinken, meeschrijven met concept en afgeronde sessie, per gebruiker, en oude logs zonder blok |

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

## Twee gebruikers

Bij de eerste start vraagt de app om twee dingen: een **huishoudcode** en **wie je bent**.
Beide worden op het toestel onthouden en zijn later te wijzigen bij Instellingen →
Huishouden.

- **Huishoudcode** — 16 tekens (0-9, a-f). Dezelfde code op beide toestellen betekent
  dezelfde gedeelde gegevens. Nog geen code? De app maakt er een. Wie de code heeft kan
  erbij, dus deel hem alleen met elkaar.
- **Wie ben je** — bepaalt alles wat je ziet en logt. Elke gebruiker heeft een eigen
  schema, eigen oefeningen, eigen sessielogs, eigen hardloopregistratie, eigen losse
  activiteiten, eigen streefgewichten en eigen voortgang.
- **Meekijken** — het tabblad met de naam van de ander toont diens streak, afgelopen
  sessies en kilometers per week. Puur om te kijken: **loggen kan alleen voor jezelf.**

Progressie en gewichtsadvies worden altijd over precies één gebruiker berekend. Dat zit in
de vorm van de data: de logica krijgt een `UserState` en kan de ander domweg niet zien. De
enige acties die buiten je eigen gebruiker komen zijn "wie ben je" en "welke huishoudcode".

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

- **Cyclus:** doorlopende 4-weekse golf, week 4 is deload (1 set minder, gewicht −10%,
  loopvolume −20%, zaterdag automatisch uit). De weken tellen gewoon door: 1, 2, 3 … 84.
- **Kalibratie:** week 1 en 2 tonen geen streefgewicht maar "op gevoel, stop bij RIR 2-3".
  Vanaf week 3 neemt de progressielogica het over op basis van wat je gelogd hebt.
- **Rotatie:** na elke 3 volledige cycli (12 weken) schuift de oefeningselectie per
  bewegingspatroon door naar de volgende variant. Permanent vervangen oefeningen blijven staan.
- **Progressie:** alle sets op de bovengrens met RIR ≤ 2 → gewicht omhoog met de kleinste
  stap, reps terug naar de ondergrens. Bij dumbbells (stap 2,5 kg) groeit eerst het aantal
  reps door tot repMax + 2. Twee sessies onder de ondergrens → streefgewicht −5%.
- **Hardloopvolume:** het weektotaal komt nooit meer dan 10% boven de vorige week;
  overschrijding wordt automatisch teruggeschaald.

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

De oefeningkeuze houdt rekening met het materiaal: de lichtste dumbbell is 12,5 kg, dus
duw- en schouderwerk loopt via kabel (chest press, laag roeien, pull-through), band
(overhead press, abductie) of lichaamsgewicht (glute bridge, step-up, kuitheffing,
dead bug). Leg press en smith laten zich vanaf de laagste stand belasten.

## Vaste volgorde binnen een sessie

Elke krachtsessie ziet er hetzelfde uit: eerst warm worden, daarna van zwaar naar licht.

**Warming-up.** Bovenaan het sessiescherm staat een blok met 5-10 min **loopband** of
**losfietsen** (spinningfiets). Het type is te kiezen, de duur instelbaar en het blok is
af te vinken, net als een oefening. De keuze hoort bij die ene sessie en wordt met het
sessielog meegeschreven, dus hij synct mee en staat er na een herlaadbeurt nog. Het
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
- **Machines en kabels**: gewoon wat er op de pin of de stapel staat.

Op Voortgang staat naast het loopvolume ook het **tilvolume per week** (gewicht × reps over
alle sets), berekend met dezelfde conventie.

## Aanpassen tijdens de rit

- **Ochtend-check-in** (1-5, optioneel): 4-5 normaal · 3 geen nieuwe gewichtsverhogingen ·
  1-2 automatisch afschalen (loop −30% of fietsen, 1 set minder, zwaar kuitwerk eruit,
  zaterdag uit).
- **Per sessie:** korte versie (alleen `core`-oefeningen, ~25 min), verplaatsen naar een
  andere dag, overslaan met reden. Een loop kan daarnaast vervangen worden door 30 min
  fietsen — dat telt als voltooid.
- **Verplaatsen:** kracht én loop kunnen naar een andere dag, onafhankelijk van elkaar. Op
  Vandaag zit de knop bij de sessie zelf; op de weekpagina heeft elke regel zijn eigen knop
  — *Open* bij de krachtsessie, *Verplaatsen* bij de loop — zodat ook een loop van morgen of
  overmorgen te verzetten is. Op
  een dag met allebei verzet je dus alleen wat je wilt verzetten. Woensdag kan nooit (bij
  Anouc maandag). Is de doeldag bezet met hetzelfde soort sessie, dan ruilen de twee van
  plek (ma ↔ vr bijvoorbeeld). Een beensessie kan nooit op zaterdag landen, ook niet via
  een ruil, omdat zondag de duurloop is; de app toont die dag geblokkeerd met de reden.
  Voor loopdagen geldt die blokkade niet: hij gaat over zware beenbelasting vlak vóór de
  duurloop, niet over de loop zelf.
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

**Firestore is de bron van waarheid, `localStorage` is de offline cache.** Elke wijziging
gaat eerst lokaal (onder de sleutel `trainingsapp.state.v1`) en daarna gebufferd naar de
cloud. Zonder internet werkt alles gewoon door; wat nog niet weg is blijft in de wachtrij
staan en gaat alsnog zodra er verbinding is. Instellingen → Huishouden toont de status en
hoeveel er nog wacht.

Opzet, gelijk aan camper-app:

- **Geen login.** De app meldt zich anoniem aan bij Firebase, puur zodat de rules een
  auth-token kunnen eisen. De niet-te-raden huishoudcode is het gedeelde geheim.
- **Eén document per gebruiker**, onder `trainingsapp/{code}/gebruikers/{id}`. Bewust geen
  gezamenlijk document: twee toestellen die tegelijk loggen schrijven zo nooit over elkaar
  heen, en de data van de ander kan niet in je eigen berekening belanden.
- **Botsingen**: het jongste `updatedAt` wint, per gebruiker.
- **Eigen Firebase-project** (`trainingsapp-c87cf`), los van de andere apps. De
  huishoudcode van camper-app wordt hier niet hergebruikt.

Wat er in de repo staat is de gewone Firebase web-config — geen geheim, die hoort in de
client. De afscherming komt van `firestore.rules`.

**Rules publiceren** (Firebase-console → Firestore → Rules): plak `firestore.rules` in zijn
geheel; rules vervangen altijd het hele bestand. Zet daarnaast onder Authentication →
Sign-in method **Anonymous** aan, anders geeft elke lees- of schrijfpoging
`permission-denied`.

Back-up blijft verstandig: **Exporteer alles** geeft een JSON met beide gebruikers,
**Importeer** leest die terug. Sinds er data is herinnert het instellingenscherm je eraan
zodra de laatste export ouder is dan 30 dagen (of er nog nooit een was).

### Versiebeheer van het formaat

De opgeslagen staat heeft een `schemaVersion` (nu **7**). Bij het laden en bij een import:

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
  er leeg bij. De huishoudcode blijft leeg tot je hem invult bij de eerste start.
- **v4 → v5** — losse activiteiten naast het schema. Oude data kent die lijst nog niet en
  krijgt een lege; bestaande sessies, loops en oefeningstanden blijven ongemoeid.
  Activiteiten uit een handgeschreven bestand worden gerepareerd: een onbekend type wordt
  `overig`, een onleesbare duur 0, en records zonder `id` vervallen.
- **v6 → v7** — drie toevoegingen per gebruiker: de instelbare stanggewichten (standaard
  trap bar 20, smith 15, olympische stang 20, deadliftstang 20, curlstang 7,5), een
  `distanceKm` bij losse activiteiten (bestaande krijgen `null`) en een eigen `runMoves`
  voor verplaatste loopsessies. Gelogde gewichten blijven ongemoeid: daar stond en staat
  het totaal in.

Niet elke toevoeging heeft een stap nodig. Het warming-upblok (`warmup` op het sessielog)
en de eigen oefeningvolgorde (`order` op de dagoverride) zijn allebei optioneel: ontbreken
ze, dan vult de app het standaardblok en de automatische volgorde in. Oude data heeft er
dus niets voor nodig en `schemaVersion` blijft op 7.

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
  logic/progression.ts streefwaarden en progressie
  logic/running.ts    loopvolume en de +10%-bewaking
  logic/startWeight.ts geschat startgewicht zonder historie
  logic/stats.ts      streaks, 1RM-verloop, weekvolume
  logic/activities.ts losse activiteiten naast het schema
  logic/barWeight.ts  stanggewicht: schijven invullen, totaal opslaan
  logic/dumbbell.ts   de dumbbell-conventie op één plek
  logic/load.ts       hoe de belasting boven een invoerveld heet
  data/programs.ts    de twee programma's: week, sjablonen, looptype, tempo
  store/sync.ts       Firestore-sync per huishouden, offline wachtrij
  store/store.ts      localStorage-store, export/import
  store/migrations.ts migratiepad tussen schemaVersions
  store/actions.ts    alle mutaties
  components/Figure.tsx  poppetje uit gewrichtshoeken, met materiaal en vloer
  components/Activities.tsx  invoer en weergave van losse activiteiten
  components/MoveSheet.tsx   dagkeuze bij verplaatsen, gedeeld door Vandaag en Week
  screens/            Welkom, Vandaag, Sessie, Week, Voortgang, Meekijken, Instellingen
firestore.rules       security rules; publiceer dit bestand in zijn geheel
tests/                vitest-suite, draait zonder browser
```
