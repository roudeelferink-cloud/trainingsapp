# Trainingsschema

Persoonlijke PWA voor een doorlopend full-body krachtschema met nadruk op benen,
gecombineerd met 3x per week hardlopen. Offline-first, installeerbaar, donker thema,
alles lokaal in `localStorage`. Geen backend, geen accounts, geen externe API's.

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
| `store.test.ts` | export/import-roundtrip, afwijzen van onzin en van nieuwere versies, migratie van oudere `schemaVersion` |
| `screens.test.tsx` | elk scherm rendert (server-side, vangt render-fouten) |

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

## Hoe het schema werkt

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

## Aanpassen tijdens de rit

- **Ochtend-check-in** (1-5, optioneel): 4-5 normaal · 3 geen nieuwe gewichtsverhogingen ·
  1-2 automatisch afschalen (loop −30% of fietsen, 1 set minder, zwaar kuitwerk eruit,
  zaterdag uit).
- **Per sessie:** korte versie (alleen `core`-oefeningen, ~25 min), verplaatsen naar een
  andere dag, overslaan met reden. Loopdagen verplaatsen niet, maar kunnen wel vervangen
  worden door 30 min fietsen — dat telt als voltooid.
- **Verplaatsen:** woensdag kan nooit. Is de doeldag bezet, dan ruilen de twee sessies van
  plek (ma ↔ vr bijvoorbeeld). Een beensessie kan nooit op zaterdag landen, ook niet via
  een ruil, omdat zondag de duurloop is; de app toont die dag geblokkeerd met de reden.
- **Per oefening:** eenmalig wisselen, permanent vervangen (rouleert dan niet meer mee),
  of overslaan.
- **Gevoelige gebieden** (Instellingen): per belast gebied ok / let op / gevoelig. Op
  *gevoelig* filtert de app alle oefeningen met dat label eruit en kiest een alternatief
  uit hetzelfde patroon. `lateral_hip` staat standaard op *let op*.
- **Reismodus:** alles naar lichaamsgewicht + band, max 30 min. Loopdagen ongewijzigd,
  de cyclus loopt door.

## Waar de data staat

Alles staat in de `localStorage` van de browser waarin je de app gebruikt, onder één
sleutel: **`trainingsapp.state.v1`**. Eén JSON-object met historie, instellingen,
streefwaarden en logs. Er gaat niets naar een server, er is geen sync tussen apparaten,
en een geïnstalleerde PWA deelt de opslag met de browser die hem installeerde.

Dat betekent ook: **browserdata wissen = alles kwijt.** Instellingen → **Exporteer alles**
geeft een JSON met de volledige staat; **Importeer** leest die terug. Sinds er data is
herinnert het instellingenscherm je eraan zodra de laatste export ouder is dan 30 dagen
(of er nog nooit een was).

### Versiebeheer van het formaat

De opgeslagen staat heeft een `schemaVersion` (nu **2**). Bij het laden en bij een import:

- **ouder dan de huidige versie** → de stappen in `src/store/migrations.ts` hogen de data op.
  Niets wordt geweigerd of gewist.
- **gelijk** → ongewijzigd overgenomen.
- **nieuwer** → import wordt geweigerd met de melding dat de app eerst bijgewerkt moet worden.
- **kapot, leeg of zonder `schemaVersion`** → aangevuld met de standaardwaarden; de app
  start altijd.

Een nieuwe versie toevoegen: verhoog `SCHEMA_VERSION` in `src/store/store.ts` en zet de
stap van de oude naar de nieuwe versie in `MIGRATIONS` in `src/store/migrations.ts`. De
sleutelnaam in `localStorage` blijft gelijk; het `v1`-achtervoegsel daarin is historisch.

Bestaande stap — v1 → v2: sessielogs kregen een `exercises`-map (slotKey → exerciseId),
zodat de voortgangsgrafiek weet welke oefening er echt gedaan is. Oude logs worden
aangevuld met de standaardoefening van dat slot.

## Structuur

```
src/
  data/exercises.ts   oefeningenbibliotheek (min. 6 per bewegingspatroon)
  data/plan.ts        weekstructuur en de sessiesjablonen
  logic/cycle.ts      weeknummer, cyclusweek, deload, kalibratie, rotatie
  logic/select.ts     welke oefening je vandaag krijgt (rotatie, gevoelig, reismodus, wissels)
  logic/day.ts        wat er vandaag te doen is
  logic/progression.ts streefwaarden en progressie
  logic/running.ts    loopvolume en de +10%-bewaking
  logic/stats.ts      streaks, 1RM-verloop, weekvolume
  store/store.ts      localStorage-store, export/import
  store/migrations.ts migratiepad tussen schemaVersions
  store/actions.ts    alle mutaties
  screens/            Vandaag, Sessie, Week, Voortgang, Instellingen
tests/                vitest-suite, draait zonder browser
```
