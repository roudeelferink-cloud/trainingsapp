# Zelf hosten en advies — bouwverslag

Branch `zelf-hosten-en-advies`. Wat er gebouwd is, wat jij nog met de hand moet doen, en
wat ik niet heb kunnen controleren.

De aanleiding staat in één zin: de Claude-sleutel mag niet in de browserbundel staan.
Alles wat een browser uitvoert kan een bezoeker lezen, dus zodra de app zelf om advies
wil vragen kan hij niet meer als losse bundel op GitHub Pages staan. Daarmee vervalt ook
de wekelijkse review per mail uit `~/trainingsreview`: diezelfde logica zit nu in de app.

---

## 1. Het servertje (`server/`)

Node, TypeScript, `node:http`. Geen framework — twee routes is het hele oppervlak.

```
POST /api/review     de volledige app-staat erin, een advies eruit
GET  /healthz        voor de container-healthcheck
```

**De vaste vorm terug.** `{ signalen: string[], advies: string[], toon: string }`, in de
app als `ReviewAdvies`. Het model krijgt dat schema mee via `output_config.format`, maar
dat is een verzoek en geen garantie: `advies.ts` keurt het antwoord daarna zelf. Ontbreekt
er een veld, is een lijst leeg, staat er een getal waar een zin hoort of is een regel
langer dan 400 tekens — dan komt er een `502` met een bericht en géén half advies. Veertien
manieren waarop een antwoord stuk kan zijn staan als losse test in `server/tests/advies.test.ts`.

Te véél is geen fout: schrijft het model acht signalen waar er vijf gevraagd zijn, dan
worden de eerste vijf gehouden en gaat de rest eraf. Een bruikbaar advies weggooien om
een vormkwestie zou het omgekeerde zijn van wat er hoort te gebeuren. De aantallen (twee
tot vijf signalen, één tot vier adviezen) staan in de opdracht aan het model en als
inkorting in `advies.ts` — níét in het schema: structured output kent `maxItems` niet en
accepteert `minItems` alleen als 0 of 1. Een schema dat dat wel bevat wordt met een 400
geweigerd, en dan komt er helemaal geen advies.

**De signalen, niet de setjes.** `server/src/signalen.ts` roept precies de functies aan
die de app zelf gebruikt: `dayGuardrails` en `legStackAround` uit `guardrails.ts`,
`deloadFor` en `weeksUntilDeload` uit `deload.ts`, `weekRunFacts`, `longestRunKm` en
`averageRunKm` uit `runningLoad.ts`, `DREMPEL` en `zoneOf` uit `opbouw.ts`, en
`heavyCountBefore`, `weekIsPoor`, `dayChecksInWeek` en `isPoorDay` uit `feel.ts`. Die
getallen gaan als JSON mee. De systeemprompt zegt er hard bij dat er niets bijgerekend mag
worden — de app toont dezelfde cijfers op het scherm ernaast, en twee versies van hetzelfde
getal maken het advies waardeloos. In de praktijk is dat een prompt van een paar kB waar
geen enkele gelogde set in zit; `signalen.test.ts` controleert dat de meegestuurde getallen
letterlijk gelijk zijn aan wat de app zelf uitrekent.

> Bijgewerkt bij het samenvoegen met `progressie-per-profiel`: het hardloopblok in de
> signalen was een plafond met een richtlijn, en is nu een telling. Zie
> BOUW-SAMENVOEGEN.md.

De opzet komt uit `~/trainingsreview/review.py`: dezelfde nuchtere toon, dezelfde drie
vragen (wat valt op / waar bouw ik te snel op / wat mag omhoog), dezelfde regel dat
"niets bijzonders" een geldig antwoord is, en dezelfde terugval bij een weigering
(`server-side-fallback`, met een herkansing zonder die parameter als het account hem niet
kent). Twee dingen zijn anders: de app rekent nu zelf, en het antwoord komt in vaste vorm
terug in plaats van als Markdown voor in een mail.

**De rem.** Eén advies per profiel per dag, gecachet in `data/reviews.json` op een
docker-volume. Opnieuw openen kost geen aanroep. De teller telt *pogingen* en gaat omhoog
vóór de aanroep, dus een aanroep die halverwege sneuvelt telt gewoon mee; na drie
mislukte pogingen op een dag geeft de server `429` tot morgen. Zonder die teller zou een
kapot netwerk de daglimiet omzeilen.

**De sleutel.** Uit `ANTHROPIC_API_KEY` in `server/.env`, met `server/.env.example`
ernaast. `.env` staat in `.gitignore`. Zonder sleutel start alles gewoon en geeft
`/api/review` een `503` — de app blijft dan volledig werken, alleen het adviesblok blijft
leeg.

**Luisteren.** Standaard `127.0.0.1:8098`. In de container staat `REVIEW_HOST=0.0.0.0`,
omdat nginx daar uit een ándere container komt; die service publiceert geen poort, dus
het enige netwerk waar hij op zit is het compose-netwerk. Vanaf de Pi zelf is `:8098`
niet te bereiken — dat heb ik nagemeten.

**Model.** `claude-opus-5`, adaptief denken, effort `high`, `max_tokens` 8000. Alles
instelbaar via `.env`. Eén aanroep per profiel per dag over ~6 kB: dat blijft ruim onder
een euro per maand.

### Een refactor die erbij hoorde

`src/store/store.ts` deed twee dingen: de vorm van de staat plus het migratiepad, én de
browser-store met localStorage en React. Het servertje heeft het eerste nodig en het
tweede niet. Het schema staat nu in `src/store/schema.ts`; `store.ts` importeert het en
exporteert alles onveranderd door, dus voor de app en de bestaande tests verandert er
niets. Zo draait de server dezelfde migratie als de import — één migratiepad in plaats van
twee die uit elkaar gaan lopen.

---

## 2. Het adviesblok

`src/components/Advies.tsx`, bovenaan Historie, in de vorm van de andere blokken daar:
kapitaal-label, haarlijnen, geen kaartjes. Alle klassen komen uit `theme.css`; er staat
geen enkele kleur of maat in het bestand, en een test controleert dat.

- **Laadt bij openen** als het opgeslagen advies niet van vandaag is. Is het van vandaag,
  dan gaat er geen verzoek uit.
- **Zwijgt als er niets is.** Nooit opgehaald, Pi uit, geen netwerk, kapot antwoord: dan
  staat er geen blok. Geen foutmelding, geen lege huls, geen spinner die blijft draaien.
  `fetchReview` geeft bij elk probleem `null` terug en gooit nooit — je kunt midden in een
  sessie in een kelder zonder bereik staan, en dan hoort de app gewoon te werken.
- **Blijft staan tijdens het verversen.** Een advies van gisteren blijft in beeld terwijl
  het nieuwe onderweg is, met de datum erbij. Zo springt het blok niet leeg en weer vol.
- **Per profiel.** Het advies zit in `UserState`, en `saveReview` controleert bij het
  opslaan of het profiel nog klopt — wie tijdens het ophalen wisselt, krijgt niet het
  advies van de ander in zijn opslag.
- **Vervangt niets.** Geen enkele bestaande guardrail is aangeraakt. De 914 tests die er
  al stonden draaien onveranderd; alleen twee assertions die het versienummer 14 vastpinden
  staan nu op 15.

De pincode gaat niet mee in het verzoek: de server doet er niets mee, dus krijgt hij hem
ook niet. Verder gaat de staat mee precies zoals de export hem opschrijft.

---

## 3. Zelf hosten

Twee containers in één compose-project naast wat er al draait, zonder er iets van aan te
raken — eigen netwerk, eigen volume, eigen `.env`, en niets aan jarvis.

```
telefoon ──tailscale──► hengelo-pi ──► 127.0.0.1:8097 (nginx)
                                          ├── /       de bundel uit dist/
                                          └── /api/ ─► api-container :8098 ─► Claude
```

Eén origin voor allebei, dus geen CORS en één poort om door te zetten. De poort staat op
`127.0.0.1`, niet op alle interfaces: zonder `tailscale serve` is er van buiten de Pi
niets te bereiken, ook niet vanaf het wifi thuis.

- **Basispad terug naar `/`.** Pages gebruikte een subpad via `VITE_BASE`; die
  omgevingsvariabele is weg. `start_url`, `scope` en `id` staan alle drie op `/`, en
  `tests/hosting.test.ts` bewaakt dat ze gelijk blijven — lopen ze uiteen, dan is de PWA
  niet meer te installeren, en dat merk je pas op je telefoon.
- **`/api` buiten de service worker.** `navigateFallbackDenylist: [/^\/api\//]`, zodat de
  worker een verzoek naar de endpoint niet als navigatie afhandelt en er `index.html` op
  teruggeeft. Zonder die regel lijkt een uitstaande Pi op een kapot antwoord in plaats van
  op geen antwoord. Ik heb in de gebouwde `dist/sw.js` nagekeken dat de denylist er echt
  in staat.
- **Cache-headers in nginx**: `assets/` een jaar (hashnamen), maar `sw.js`,
  `manifest.webmanifest` en `index.html` op `no-cache` — een oude service worker uit de
  browsercache is precies hoe een update blijft hangen.
- **De Pages-workflow is verwijderd.** `.github/workflows/deploy.yml` bestaat niet meer;
  er staat nu `tests.yml`, die bij elke push de tests van de app én van het servertje
  draait en verder niets publiceert. Er is geen weg meer waarop er ongemerkt iets naar
  Pages gaat.

---

## 4. Data overzetten

Het nieuwe adres is voor de browser een nieuwe origin, dus `localStorage` begint leeg.
De weg terug is *Exporteer alles* op het oude adres, *Importeer* op het nieuwe.

Om te weten dat dat écht zonder verlies gaat heb ik geen voorbeeldbestand geschreven maar
een echte export gemaakt: via een tijdelijke git-worktree van `main` draait de
`exportJSON()` van de Pages-versie over negen weken historie voor beide profielen, en die
uitvoer staat als `tests/fixtures/export-pages-v14.json` in de repo (schemaVersion 14,
53 kB). `tests/overzetten.test.ts` leest dat bestand in en vergelijkt veld voor veld:
sessies, loops, streefgewichten, check-ins, dagchecks, losse activiteiten, afwijkingen,
meldingen, instellingen, overgeslagen dagen, verplaatsingen, overrides, weggeklikte
meldingen, de pincode en het gekozen profiel. Plus een telling, plus een tweede rondje
export-import.

**Schemawijziging: 14 → 15.** `UserState` heeft er één veld bij, `review`, waar het
laatste advies in staat. Migratie `v14_to_v15` zet dat op `null` voor bestaande data en
laat de rest onaangeroerd; die stap heeft zijn eigen tests in `tests/migratie.test.ts`
(los van de volledige migratie, inclusief een half advies dat geweigerd wordt).

---

## Wat jij met de hand moet doen

Alles staat uitgeschreven in **`README-HOSTING.md`**. Kort:

1. **`server/.env` vullen** met een nieuwe Anthropic-sleutel met label `trainingsapp`
   (niet die van de nieuws-poller of van `~/trainingsreview` hergebruiken).
2. **`docker compose up -d --build`** in `~/trainingsapp`.
3. **`sudo tailscale serve --bg --https=443 http://127.0.0.1:8097`** — als root, en het
   enige dat de app buiten de Pi bereikbaar maakt. HTTPS is geen luxe: zonder secure
   context registreert de service worker niet, en dan is de app niet installeerbaar en
   niet offline bruikbaar.
4. **De Tailscale-ACL** zodat Anouc's toestel alleen bij `hengelo-pi:443` kan en niet bij
   SSH, jarvis (8095), trace (8000) of de edge-stack. Het complete blok staat in
   README-HOSTING.md; haar toestel moet daarvoor wel in het tailnet zitten.
5. **Je gegevens overzetten**: exporteren op het oude Pages-adres, importeren op het
   nieuwe. Doe dat vóórdat je de oude versie van je beginscherm gooit.
6. **Pushen.** Ik heb niet gepusht, dat staat op deny.

`~/trainingsreview` hoeft niets: er staat op deze Pi geen systemd-timer voor
geïnstalleerd (nagekeken in `systemctl --user list-unit-files` en
`/etc/systemd/system`), dus er draait niets stiekem door. De SendGrid-sleutel in die
`.env` doet nu niets meer; intrekken kan geen kwaad.

---

## Wat ik wél heb gecontroleerd

- **1036 tests groen**: 954 in de app (`npm test`), 82 in het servertje
  (`npm --prefix server test`). Samen met `npm run test:alles`.
- **Typecheck groen** in allebei de projecten.
- **`npm run build`** draait door, en in de uitvoer staan `start_url`/`scope`/`id` op `/`
  en de `/api`-denylist in `sw.js`.
- **De hele stack draait op deze Pi.** `docker compose up -d --build` gebouwd en gestart;
  beide containers `healthy`. `GET /` 200, `/manifest.webmanifest` 200, `/sw.js` 200, een
  diepe link (`/historie`) 200 via de fallback.
- **De echte export van 53 kB door de endpoint gestuurd** via nginx: hij wordt aangenomen,
  gemigreerd, en komt netjes uit op `503 geen_sleutel` (want er staat nog geen sleutel).
- **Het volledige pad met een nagebootste Claude-API.** Die stubserver was eerst een
  wegwerpscript; hij staat nu als `server/tests/nepApi.ts` in de suite, en
  `claude.test.ts` praat er over een echte verbinding tegenaan. Gecontroleerd:
  `claude-opus-5`, `thinking: adaptive`, `effort: high`, `output_config.format` van het
  type `json_schema`, beta-header `server-side-fallback-2026-07-01`, de terugval naar een
  aanroep zonder die parameter, en een prompt waar `loopvolume` in staat en `entries`
  niet. De nagebootste API keurt het schema net zo streng als de echte, dus een schema met
  `maxItems` of `minItems: 2` maakt de tests rood in plaats van pas de eerste echte
  aanroep. Daarnaast, met de draaiende stack: het advies kwam terug, de tweede aanroep
  kwam uit de cache (`gecached: true`, geen tweede aanroep naar de API), en `reviews.json`
  stond op schijf.
- **De afscherming nagemeten**: `:8098` op de host is niet bereikbaar, en `:8097` op het
  tailscale-adres ook niet — dat moet inderdaad via `tailscale serve`.

### Tegen de echte API, met de sleutel erin (26 augustus)

Sinds de sleutel in `server/.env` staat is dit niet meer nagebootst maar echt. Container
opnieuw gebouwd, en alles hieronder liep via `http://127.0.0.1:8097/api/review` — dus door
nginx heen, op het adres dat de telefoon ook gebruikt.

**De nieuwe grenzen.** Eén `POST` voor profiel `anouc` met de export uit
`tests/fixtures/export-pages-v14.json`:

| | vóór de fix (rob, uit de dagcache) | nu (anouc) |
| --- | --- | --- |
| signalen | 8 | **5** |
| adviezen | 6 | **4** |

Status 200, 22 seconden. Een tweede aanroep op een andere dag gaf 5 signalen en 2
adviezen — ook binnen de grenzen, en korter omdat er minder te melden was.

**Het inkorten hoefde niet te vuren.** Dat is de nuttigste uitkomst: er stond geen enkele
`ingekort`-regel in de log, dus het model schreef uit zichzelf vijf en vier. De aantallen
in de opdracht komen dus aan; de inkorting in `advies.ts` is een vangnet en niet het ding
dat het werk doet. Dat verschil was niet af te lezen aan het advies zelf — vijf signalen
ziet er hetzelfde uit of het er nu vijf of acht waren — dus dat staat nu in de log.

**Wat er wél ingekort is.** Het advies dat vóór de fix voor rob opgeslagen was (8 en 6)
gaat bij het lezen van de dagcache door dezelfde keuring, dus dat staat nu als 5 en 4 in
`reviews.json`. Eén kanttekening: rob's telefoon heeft die 8 al opgeslagen en haalt pas
morgen een nieuwe op. Tot die tijd staat er op zijn scherm nog het lange advies; er gaat
niets stuk van, en morgen is het weg.

**Cache: tweede aanroep, geen tweede API-call.** Dezelfde `POST` nog een keer, zelfde
profiel en dezelfde dag:

- `gecached: true`, en `gegenereerdOp` exact hetzelfde tijdstip als de eerste keer
- het advies letterlijk identiek
- 0,02 seconde in plaats van 22 — dat is geen aanroep die snel was, dat is geen aanroep
- in de log staat `advies voor anouc (2026-08-26), uit de cache`, en `pogingen` in
  `reviews.json` bleef op 1 staan

**Daglimiet: drie pogingen, dan 429.** Dit hoefde niet met unit-tests: door de container
tijdelijk naar een dood API-adres te laten wijzen mislukt elke aanroep echt, zonder dat
het iets kost. Vier keer achter elkaar, op een eigen datum zodat de gewone dagcache er
buiten bleef:

```
poging 1: {"fout":"api_onbereikbaar","bericht":"De Claude-API gaf geen antwoord: Connection error."} [502]
poging 2: {"fout":"api_onbereikbaar",...}                                                            [502]
poging 3: {"fout":"api_onbereikbaar",...}                                                            [502]
poging 4: {"fout":"te_vaak","bericht":"Vandaag al 3 keer geprobeerd voor anouc. Morgen weer."}        [429]
```

De cacherij stond daarna op `pogingen: 3` zonder advies — precies zoals bedoeld: de teller
telt pogingen en niet successen, dus een kapot netwerk omzeilt de limiet niet. Daarna is
het dode adres eruit gehaald, de dagcache teruggezet en gecontroleerd dat de container
weer normaal draait (geen `ANTHROPIC_BASE_URL` in de omgeving, beide profielen met een
geldig advies voor vandaag).

De app zelf loopt hier niet tegenaan: die vraagt hooguit één keer per dag. De limiet is er
voor het geval er iets blijft hangen.

## Wat ik niet heb kunnen controleren

Nog vier dingen, en dat zijn precies de dingen die aan jouw kant zitten. Punt 1 hieronder
is inmiddels wél gedaan; hij blijft staan omdat wat eruit kwam er nog steeds toe doet.

1. **Een echte aanroep naar de Claude-API.** ~~Er staat geen sleutel op deze Pi.~~
   *Afgehandeld.* De sleutel staat er inmiddels, en de aanroep is gedaan — zie "Tegen de
   echte API" hierboven. Wat het opleverde in het kort: de eerste poging liep stuk op het
   schema (`minItems: 2` en `maxItems` bestaan niet in structured output, dus een 400 en
   geen advies), en het model hield zich daarna niet aan de gevraagde aantallen — acht
   signalen en zes adviezen. Allebei opgelost, allebei nu afgedekt: de nagebootste API in
   `server/tests/nepApi.ts` weigert dezelfde schema's als de echte, en de aantallen staan
   in de opdracht met een inkorting als vangnet.

   Wat blijft: of het advies inhoudelijk klopt over jóuw training is niets wat een test
   kan zeggen. Lees de eerste paar zelf na en kijk of de getallen die het noemt overeenkomen
   met wat er op Week en Historie staat — dat is de enige controle die telt.

2. **`tailscale serve`.** Aanzetten vraagt root en verandert wat er buiten de Pi te zien
   is; dat is niet iets om ongevraagd te doen. Het commando in README-HOSTING.md is
   ongetest op dit toestel — `tailscale serve status` zegt nu "No serve config".
3. **De Tailscale-ACL.** Die staat in de cloud, niet op de Pi. Het blok in
   README-HOSTING.md is uitgeschreven maar niet toegepast; de e-mailadressen moet je zelf
   invullen, en de **Access rules**-preview in de editor is de plek om te controleren dat
   Anouc bij `:443` wel en bij `:22` niet mag.
4. **Installeren als PWA op een telefoon.** Manifest en service worker kloppen in de
   bundel en het basispad is nagelopen, maar "toevoegen aan beginscherm" en offline
   openen heb ik niet op een echt toestel gedaan. Dat vraagt HTTPS, en dus stap 3.
5. **Een export van jóuw telefoon.** De overzet-test draait op een export die door de
   code van `main` gemaakt is — dezelfde code die op Pages staat — maar met verzonnen
   historie. Jouw echte bestand kan velden bevatten die daar niet in zitten. Importeer
   hem één keer op het nieuwe adres en kijk of je historie klopt; gaat er iets mis, dan is
   het oude adres nog gewoon te openen en is er niets kwijt.

Verder één ding dat geen controle maar een keuze is: de containers draaien nu op deze Pi
met een lege `server/.env`. Zodra jij de sleutel invult is een `docker compose up -d`
genoeg — de container leest het bestand bij het starten.
