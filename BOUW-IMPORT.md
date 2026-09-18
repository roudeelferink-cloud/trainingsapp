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
