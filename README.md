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

## Deployen naar GitHub Pages

De app draait vanaf een submap op Pages, dus de base-path moet mee. Die komt uit de
env-variabele `VITE_BASE`.

**Optie 1 — automatisch via Actions.** `.github/workflows/deploy.yml` staat er al in.
Zet in de repo-instellingen *Settings → Pages → Source* op **GitHub Actions** en push
naar `main` (of `master`). De workflow zet `VITE_BASE` op `/<repo-naam>/` en publiceert
`dist/`.

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

## Data

Alles staat in `localStorage` onder één sleutel, met `schemaVersion`. Instellingen →
**Exporteer alles** geeft een JSON met de volledige historie; **Importeer** leest die terug
en valideert op `schemaVersion`. Een export uit een nieuwere versie wordt geweigerd.

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
  store/              localStorage-store en alle mutaties
  screens/            Vandaag, Sessie, Week, Voortgang, Instellingen
```
