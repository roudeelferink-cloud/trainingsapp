# Bouwverslag — import neemt de historie mee

Tak `import-historie`, afgetakt van `main` (`3cae1ca`). Niet gepusht.

## Klacht

Na het importeren van een JSON-export verschijnt de historie (sessielogs, loopsessies,
check-ins) niet. Instellingen en profiel lijken wel mee te komen.

## Onderzoek

1. **Migratieketen v14 → v18.** Geen verlies. Beide fixtures (`export-pages-v14.json` uit
   `~/trainingsreview/fixtures`, en `export-v18.json` daarnaast) komen op een leeg toestel
   volledig binnen: 18 sessies, 18 loops en 18 check-ins per profiel, zichtbaar in Historie
   en in `historyFor`/`loggedExercises`. De enige bewuste verandering onderweg: in v18
   verdwijnen slaap en energie, en `checkins` gaat op in `dayChecks` (benen 1–5 wordt
   fris/normaal/zwaar). Een dag met alleen slaap/energie heeft daarna geen dagcheck meer,
   zoals al gedocumenteerd bij `v17_to_v18`. Geen sessie of loop wordt hernoemd.
2. **Koppeling aan het actieve profiel. Hier zat de fout.** `importJSON` verving de hele
   staat door die van het bestand, en zette `currentUser` op de waarde uit het bestand.
   Een export bevat altijd beide profielen. Op een toestel dat door één persoon gebruikt
   wordt, staat het andere profiel er leeg in. Na een import:
   - sprong het toestel naar het profiel van wie het bestand maakte. De historie die je
     verwachtte stond dan onder een ander profiel-ID dan waar de app naar keek;
   - werd de historie van het profiel van dit toestel overschreven door het lege profiel
     uit het bestand. Instellingen kwamen wél mee: een leeg profiel heeft ook instellingen.
3. **Samenvoegen of overschrijven.** Overschrijven, en dus zonder waarschuwing: alles wat
   lokaal gelogd was en niet in het bestand stond, verdween. Ook de pincode van het
   toestel werd vervangen door die uit het bestand.

## Fix

`src/store/merge.ts`: `mergeImport(lokaal, bestand)`. `importJSON` migreert het bestand
zoals voorheen en voegt het daarna samen in plaats van het te vervangen:

- **Historie per profiel wordt samengevoegd:** sessies, loops en dagchecks op sleutel,
  activiteiten en afwijkingen op id, meldingen op datum+tekst, en de planning per dag
  (skips, moves, overrides, runPlans, deloadSkips). Opnieuw importeren geeft dus geen
  dubbele logs.
- **Dezelfde sessie of loop aan beide kanten:** afgerond wint van een concept, en bij
  twee afgeronde de laatst afgeronde (`completedAt`). Bij gelijkspel blijft de lokale.
- **Instellingen, streefgewichten en startdatum** komen van de kant met de jongste
  historie. Een profiel dat lokaal nog niets gelogd heeft, neemt het bestand in zijn
  geheel over (zoals voorheen). Een leeg profiel in het bestand laat het lokale ongemoeid.
- **Actief profiel en pincode** horen bij het toestel. Ze komen alleen uit het bestand
  als ze hier nog niet gezet zijn. Verhuizen naar een leeg toestel werkt dus als vanouds.

Aangepast: de tekst bij Importeer in Instellingen ("vervangt alles" → "voegt samen"), de
melding na import, en de README.

Bewuste keuze: bij twee afgeronde versies van dezelfde sessie blijft er één over, de
laatst afgeronde. Dat is een bewerking van dezelfde sessie, geen tweede sessie.

## Getest

`tests/importHistorie.test.ts` (13 tests). De fixture `tests/fixtures/export-v18.json` is
nieuw, gekopieerd uit `~/trainingsreview/fixtures`. Vóór de fix faalden er 6:

- v14 en v18 op een leeg toestel: aantal sessies, loops en check-ins per profiel, en
  Historie (`completedSessions`, `completedRuns`) plus historie per oefening
  (`loggedExercises`, `historyFor`) tonen ze voor beide profielen;
- toestel op Anouc met eigen historie: het profiel blijft Anouc, de historie uit het
  bestand komt erbij en de eigen sessie blijft staan (v14 en v18);
- een export van een toestel met één profiel (het andere leeg) wist geen lokale historie;
- de pincode van het toestel blijft;
- twee keer hetzelfde bestand (v14 en v18): sessies, loops, dagchecks, activiteiten,
  afwijkingen en meldingen identiek aan één keer;
- een lokaal concept verliest van een afgeronde sessie uit het bestand, en een later
  afgeronde lokale sessie blijft staan.

**Stand:** `npm test` 1143 groen (55 bestanden), `npm run test:server` 89 groen,
`npm run build` (inclusief `tsc --noEmit`) schoon. De bestaande `overzetten.test.ts`
(verhuizen v14) is ongewijzigd groen.

---

# Vervolg — een v16-export op een vers toestel

Tak `import-v16`, afgetakt van `main` (`2699176`). Niet gepusht.

## Klacht

Na de fix hierboven verschijnt de historie in de praktijk nog steeds niet. Het bestand:
een echte export, schemaVersion 16, `currentUser: 'rob'`, met onder `rob` 14 afgeronde
sessies, 9 loops en 15 check-ins, en een klein beetje onder `anouc`.

## Onderzoek

Gereproduceerd met precies dat bestand (buiten de repo), via `importJSON` — dezelfde
functie die de knop Importeer in Instellingen aanroept; het scherm leest het bestand en
geeft de tekst ongewijzigd door. Historie en `historyFor`/`loggedExercises` lezen het
actieve profiel (`useStore`/`getState`).

1. **Migratie v16 → v18: geen verlies.** Per sessie dezelfde sets en dezelfde
   oefeningen, elke loop ongewijzigd, de 15 check-ins worden 15 dagchecks (benen), de
   activiteiten gaan mee. Alleen slaap en energie vervallen, zoals bedoeld sinds v18.
2. **Leeg toestel, of een toestel op `rob`:** alles komt binnen en is zichtbaar: 14
   sessies, 9 loops, 15 dagchecks, 34 oefeningen in de historie per oefening.
3. **Toestel op een ander profiel: hier zit het.** Een verse installatie maakt geen
   eigen id aan: `defaultRoot()` zet `rob` en `anouc` klaar met `currentUser: ''`. Maar
   Importeer zit in Instellingen, en daar kom je pas na de onboarding — het toestel
   staat dus al op een gekozen profiel, zonder historie. Stond dat op `anouc`, dan
   landde de historie netjes onder `rob`, maar de fix hierboven liet het toestel bewust
   op `anouc` staan ("het bestand bepaalt niet wie dit toestel gebruikt"). Historie
   toonde daarna de 2 sessies van Anouc uit het bestand in plaats van de 14 van Rob.

Die regel klopte voor een toestel dat al gebruikt wordt, maar niet voor een toestel waar
nog niets op staat.

## Fix

`kiesProfiel` in `src/store/merge.ts`:

- heeft het profiel van dit toestel historie, dan blijft het toestel daarop (zoals na de
  vorige fix);
- is het nog leeg, dan gaat het toestel naar het profiel dat het bestand als gebruiker
  noemt, als dat historie heeft — of, noemt het bestand niemand, naar het enige profiel
  in het bestand met historie;
- anders blijft het staan.

Er gaat niets verloren: het samenvoegen van de historie is ongewijzigd, beide profielen
houden hun gegevens, de pincode van het toestel blijft. Stil is het ook niet:
`importJSON` geeft dan `profiel` terug, en Instellingen meldt "Dit toestel staat nu op
Rob; wisselen kan bij Profiel."

## Fixture

Het echte bestand staat niet in de repo: die is publiek, en het bevat een pincode en
persoonlijke gegevens. `tests/fixtures/export-v16.json` is eruit gemaakt, ingekort en
geanonimiseerd: nog steeds schemaVersion 16 met `checkins` én de oude `dayChecks`, en
`currentUser: 'rob'`; 5 sessies (3 met leg press), 4 loops en 6 check-ins onder `rob`, 1
van elk onder `anouc`. Een andere pincode; geen notities bij activiteiten, geen
afwijkingen, meldingen of opgeslagen advies, geen notitie per oefening, een ander
lichaamsgewicht.

## Getest

In `tests/importHistorie.test.ts`, 8 tests erbij. Met de code van `main` falen er 2: het
toestel op een leeg ander profiel (de klacht) en het bestand zonder gebruiker.

- leeg toestel en toestel op `rob`: 5 sessies, 4 loops, 6 dagchecks, zichtbaar in
  Historie en de historie per oefening (leg press 3×);
- toestel op leeg `anouc`: het toestel gaat naar Rob, de import meldt dat, Rob ziet zijn
  historie en Anouc houdt wat het bestand voor haar had;
- toestel op `anouc` mét eigen historie: blijft op Anouc, niets verloren;
- bestand zonder gebruiker: het enige profiel met historie;
- de pincode blijft, ook als het profiel wisselt;
- twee keer hetzelfde v16-bestand: geen dubbele historie.

Met het echte bestand nagelopen, in alle drie de situaties (leeg, `rob`, leeg `anouc`):
het profiel dat je daarna ziet toont 14 sessies, 9 loops en 15 dagchecks.

**Stand:** `npm test` 1151 groen (55 bestanden), `npm run test:server` 89 groen,
`npm run build` (inclusief `tsc --noEmit`) schoon.
