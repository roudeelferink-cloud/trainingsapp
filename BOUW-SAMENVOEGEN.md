# De twee takken bij elkaar — bouwverslag

`progressie-per-profiel` is samengevoegd met `main`. Niet gepusht.

Twee takken die naast elkaar liepen: de ene zette de app op de Pi met een review-endpoint
ernaast, de andere haalde het hardloopadvies eruit en zette de progressie op gelogde
sessies. Ze raakten elkaar op drie plekken, en die zijn alle drie met de hand opgelost.

---

## 1. Het schemaconflict

Allebei de takken zetten `SCHEMA_VERSION` op 15, met een andere migratie eronder.

**Wat 15 blijft:** het advies erbij (`review` per gebruiker). Die versie draaide al op een
toestel en stond al in de dagcache van de server. Een versienummer waarvan de inhoud
achteraf verandert is geen versienummer meer — dan zou een toestel dat op 15 staat denken
dat het bij is terwijl het de progressie-instelling mist.

**Wat 16 wordt:** de progressiestap. `settings.progressie` erbij, `hitStreak` op 0 per
oefening, `dismissedWarnings` eruit.

De keten loopt nu door van 1 tot 16, zonder gaten. Testdekking, in `tests/migratie.test.ts`:

| Test | Wat hij vastlegt |
| --- | --- |
| `v14 -> v15` (5 tests) | het adviesveld op null, een bestaand advies blijft staan, de rest onaangeroerd, en half advies wordt geweigerd |
| `v15 -> v16` (6 tests) | het tempo per profiel (Rob opbouwen, Anouc onderhoud), een bestaand tempo blijft staan, schone teller per oefening, `dismissedWarnings` weg, het advies uit v15 blijft, rest onaangeroerd |
| `de keten van 14 naar 16` (5 tests) | elke stap bestaat, beide stappen draaien in volgorde met beide uitkomsten, halverwege stoppen doet precies de eerste stap en niet de helft van de tweede, de volledige migratie komt op alles tegelijk uit, en twee keer migreren doet niets extra |

Die derde groep is er omdat het faalgeval hier niet "een stap werkt niet" is maar "de
stappen kennen elkaars aannames niet". Vandaar de test die halverwege stopt: op 15 hoort
`progressie` er nog niet te zijn en `dismissedWarnings` er nog wel.

---

## 2. `server/src/signalen.ts`

Die riep zes functies aan die niet meer bestaan: `weekLoad`, `weekProjection`,
`longRunTarget`, `rollingReference`, `risesInARow` en `legRunConflict`.

Het hele `loopvolume`-blok — plafond, richtlijn, referentie, opbouwlijn van de duurloop,
rem op stijgen, prognose — is vervangen door `hardlopen`, en dat zijn vijf tellingen:

```
hardlopen: {
  dezeWeekLopen, dezeWeekKm, langsteLoop4WkKm,
  gemiddeldeDuurloopKm, gemiddeldeKorteLoopKm
}
```

Geteld, niet bedacht. `benenVoorDuurloop` is eruit (die waarschuwing bestaat niet meer);
`beenStapeling` — twee zware beendagen achter elkaar — blijft, want die gaat over kracht.
Per week is `richtlijnKm` vervangen door `lopen` (hoe vaak er gelopen is).

Er staat een test op die het van de andere kant vastlegt: de sleutels van `hardlopen` zijn
precies die vijf, en de woorden `plafond`, `richtlijn`, `duurloopDoel` en
`benenVoorDuurloop` komen nergens meer in de signalen voor.

### De prompt

Drie dingen bijgewerkt in `server/src/prompt.ts`:

- **In de systeemprompt**, in hoofdletters omdat het de enige harde grens is:
  *"ADVIEZEN GAAN UITSLUITEND OVER KRACHTTRAINING."* Met erbij dat de app het hardlopen
  niet plant, dat gelopen kilometers als feit en als context genoemd mogen worden, en dat
  er nooit een afstand, een aantal lopen, een opbouw of een looprustdag geadviseerd wordt
  — ook niet voorzichtig, ook niet als suggestie. Zonder die laatste zin gaat een model
  invullen wat er weg is.
- **In de veldbeschrijving** van `advies` in het antwoordschema, want dat is wat het model
  leest op het moment dat het dat veld schrijft.
- **In de opdracht zelf**: het `advies`-punt noemt de opbouwtellers als bron en zegt dat
  kilometers wel meewegen als context maar geen onderwerp zijn.

---

## 3. De progressie-instelling in de signalen

Nieuw blok `progressie`, zodat het advies weet hoe de app zelf staat afgesteld:

```
progressie: {
  tempo:        { benen, bovenlichaam, romp }  -> 'opbouwen' of 'onderhoud'
  drempel:      { benen, bovenlichaam, romp }  -> 3 of 6 sessies
  maxPerSessie: 2
  voorrang:     'benen'
  tellers:      [{ oefening, zone, gehaaldOpRij, drempel, kg }]   // dichtst bij een stap eerst
}
```

De systeemprompt zegt erbij waarom dat er staat: *"zeg niet dat er zwaarder getild moet
worden als de app dat over twee sessies uit zichzelf doet."* Een advies dat het scherm
ernaast tegenspreekt is erger dan geen advies.

---

## 4. Extra werk binnen een sessie

Dit kwam er tijdens het samenvoegen bij. **Eerst wat ik aantrof, voordat ik iets wijzigde:**

| Vraag | Antwoord vooraf |
| --- | --- |
| Komt een extra oefening in het sessielog? | **Ja** — als gewoon slot (`legs_a:extra`), met een eigen regel in `entries` en `exercises` |
| Telt hij in het tilvolume per week? | **Ja** — `sessionVolumeKg` leest `entries`; in de probe ging één sessie van 12.500 naar 17.000 kg |
| Telt hij in de opbouwteller van die oefening? | **Ja** — het slot zit in `slots`, dus `beoordeelSessie` draait erover |
| Staat hij in `deviations`? | **Nee** — er wordt niets vastgelegd bij het toevoegen |
| Ziet het model dat er werk bij is gezet? | **Nee** — alleen het volume, en dat is niet van een zware sessie te onderscheiden |

Over `deviations`: daar hoort hij ook niet. Dat veld gaat over *afwijken van een voorstel*
— verder lopen dan gepland, zwaarder tillen dan voorgesteld, een deload overslaan. Een
oefening die de app zelf aanbiedt en die jij aanneemt is het tegenovergestelde daarvan.
Het als afwijking wegschrijven zou de lijst betekenisloos maken.

**Wat er wel gebeurd is:**

1. **Een bug eruit.** `addExtraExercise` zet `completedAt` op null om de sessie weer te
   kunnen openen, en de controle die dubbeltellen moest voorkomen keek juist naar dat
   veld. Daardoor telde bij het opnieuw afronden de héle sessie een tweede keer. Met de
   oude regel viel dat weg tegen de weekgrens; met de opbouwteller schoot een oefening er
   in één keer twee sessies mee vooruit. De controle kijkt nu alleen naar de opgeslagen
   sets — en alleen `completeSession` schrijft die, dus identieke sets zijn per definitie
   al geteld.
2. **Zichtbaar in de signalen.** Per week staat er nu `extraOefeningen`: de namen van de
   oefeningen die er binnen een sessie bij gedaan zijn. De markering van een
   volumeverhoging (de andere route na een te makkelijke sessie) staat er bewust niet
   tussen — dat is geen oefening.
3. **Vastgelegd in tests**, aan beide kanten, want dit is precies wat ongemerkt wegvalt
   zodra er aan de sessieopbouw gesleuteld wordt.

**Losse activiteiten blijven registratie.** Fietsen, wandelen en zwemmen raken het
tilvolume niet, komen niet in de sessies terecht en gaan niet naar het model — er staat
een test die controleert dat de signalen letterlijk het woord `fietsen` en de notitie bij
de activiteit niet bevatten. Eén nuance: een **hardloop**activiteit telt wel mee in de
gelopen kilometers van de week. Dat is dezelfde telling die de app zelf op Vandaag en
Historie toont, en het is een feit en geen advies.

Terzijde: `BUMP_MARKER` is verhuisd van `store/actions.ts` naar `logic/extra.ts`. De
server moet weten of `log.extra` een oefening is of die markering, en `actions.ts` trekt
via de store React de serverbundel in. Nagemeten: `dist/server.js` bevat nul verwijzingen
naar React.

---

## 5. Wat er gedraaid en gemeten is

### Tests en typechecks

| | Uitkomst |
| --- | --- |
| `npm test` (app) | **937 groen**, 44 bestanden |
| `npm --prefix server test` | **89 groen**, 8 bestanden |
| `npm run typecheck` (app) | schoon |
| `npm --prefix server run typecheck` | schoon |
| `npm run build` | draait door |

### Containers

`docker compose build` en `up -d --force-recreate` voor allebei; beide `healthy`. De
statische kant is nagelopen: `/`, `/manifest.webmanifest`, `/sw.js` en een diepe link
(`/historie`) geven alle vier 200.

### Eén echte aanroep per profiel

Via `http://127.0.0.1:8097/api/review`, dus door nginx heen, met de export uit
`tests/fixtures/export-pages-v14.json` als staat. De dagcache is eerst geleegd zodat het
echte aanroepen waren en geen cachetreffers.

**Rob** — 200, 17 seconden, 5 signalen en 3 adviezen:

> **toon:** "Vier weken stil, dus dit is een herstart op het niveau van week 9 — niet daarboven."
>
> *signaal:* "De opbouwtellers staan allebei op 0 van 3: leg press op 140 kg, bench smith op 62,5 kg."
>
> *advies:* "Houd leg press op 140 kg × 10 en bench smith op 62,5 kg × 8 — de tellers staan op 0 van 3, dus verhogen doet de app zelf zodra je drie sessies volledig haalt."

**Anouc** — 200, 11 seconden, 4 signalen en 3 adviezen:

> **toon:** "Vier weken stil, dus dit is een herstart op de oude gewichten, niet een volgende stap."
>
> *signaal:* "Beide opbouwtellers staan op 0 van 6, dus na de pauze staat de progressie op nul."
>
> *advies:* "Pak de draad op met dezelfde streefgewichten als voor de pauze: leg press 140 kg en bench smith 62,5 kg, niets verhogen."

Dat is precies wat punt 3 moest opleveren: **dezelfde historie, een ander advies, omdat het
tempo verschilt.** Rob leest "0 van 3", Anouc "0 van 6", en allebei noemen ze dat de app
zelf verhoogt. In de fixture hebben beide profielen hetzelfde logboek, dus het verschil
komt volledig uit de instelling.

Nagelopen op de uitkomst:

- **Geen enkel advies noemt hardlopen.** Alle zes de adviesregels zijn op `km`,
  `kilometer`, `duurloop`, `lopen` en `hardlo` gecontroleerd: nul treffers. Kilometers
  komen wel in de *signalen* voor ("0 km"), en dat is de bedoeling — feit, geen advies.
- **Geen `ingekort`-regel in de log**, dus het model bleef uit zichzelf binnen twee tot
  vijf signalen en één tot vier adviezen.
- **De cache doet het:** een derde aanroep voor Rob gaf `gecached: true` met hetzelfde
  tijdstip, in 0,04 seconde en zonder API-aanroep.

Beide profielen hebben nu een advies van vandaag in de dagcache, gemaakt door de
samengevoegde code. De oude inhoud staat als back-up in de sessiemap onder
`reviews-voor-merge.json`; nodig is dat niet, het nieuwe advies is het betere.

---

## Wat jij nog moet doen

1. **Pushen.** Ik heb niet gepusht. De merge staat als één commit bovenop `main`, met de
   twee vervolgcommits erna.
2. **Je tempo controleren** in Instellingen → Tempo van de opbouw. Rob staat overal op
   opbouwen, Anouc overal op onderhoud; dat zijn startwaarden, geen meting.
3. **Je stash opruimen.** In `git stash list` staat nog
   `server/.env-regel in .gitignore` uit de vorige ronde. Die is overbodig geworden —
   `main` heeft die regel inmiddels als eigen commit (`02ca3d4`). `git stash drop` kan,
   maar dat laat ik aan jou.

## Wat ik niet heb kunnen controleren

- **Of het advies inhoudelijk klopt over jouw training.** De aanroepen liepen op de
  fixture, en dat is gegenereerde historie: negen weken met twee oefeningen, waarin beide
  profielen hetzelfde logboek hebben. Dat is prima om te zien dat de leidingen kloppen en
  dat het tempo doorwerkt, maar het zegt niets over wat het model van jouw echte weken
  vindt. Lees de eerste paar adviezen na en kijk of de getallen overeenkomen met wat er op
  Week en Historie staat.
- **De eerste echte verhoging.** De opbouwregel gaat uit van de streefwaarden die er nu
  staan; die komen uit de oude regel en zijn nooit tegen deze drempel aangehouden. Of de
  eerste stap op het goede moment komt zie je pas over drie sessies.
- **`tailscale serve` en de ACL.** Ongewijzigd sinds de vorige ronde, en nog steeds niet
  door mij aangezet — zie README-HOSTING.md.
