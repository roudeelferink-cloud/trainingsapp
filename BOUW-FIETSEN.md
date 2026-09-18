# Bouwverslag — kracht vervangen door fietsen, en een eenvoudiger dagcheck

Tak `kracht-vervangen-fietsen`, afgetakt van `main` (`0356e01`). Niet gepusht.

| Commit | Onderwerp |
| --- | --- |
| `deecddb` | dagcheck: benen en pijn, slaap en energie eruit (SCHEMA_VERSION 18) |
| `74e1f75` | krachtsessie vervangen door fietsen: de logica |
| `6658f19` | vervang door fietsen: de schermen |
| (dit bestand) | bouwverslag en README |

**Stand:** `npm test` 1130 groen (54 bestanden, was 1052 in 51), `npm run test:server`
89 groen, `tsc --noEmit` schoon, `npm run build` schoon. Hardlopen is niet aangeraakt:
er is geen regel bijgekomen die iets over een loop zegt.

---

## 1. De dagcheck

### Wat het was, wat het is

Het waren drie vragen verdeeld over twee velden: slaap en energie (1–3) in `dayChecks`, en
"benen en pezen" (1–5) in `checkins`. Nu zijn het er twee, allebei optioneel, in één veld:

```ts
interface DayCheck {
  legs?: 'fris' | 'normaal' | 'zwaar'
  pain?: 'knie' | 'rug' | 'schouder' | 'heup' | 'anders' | null   // null = "nee"
}
```

Op Vandaag: benen (drie segmenten), pijn nee/ja, en bij ja een rooster met de vijf plekken.
Twee tikken zonder pijn, drie met. "Ja" zonder plek wordt niet opgeslagen: pas de plek is
een antwoord. De vijf plekken staan in een rooster en niet in een segmentrij, omdat
"Schouder" naast een labelkolom op een 375pt-scherm niet in een vijfde van de breedte past.

### Migratie (v17 → v18)

- `checkins` gaat op in `dayChecks[datum].legs`: 1–2 → zwaar, 3 → normaal, 4–5 → fris. Dat
  is precies de grens die de app al trok (onder de 3 ging er een set af), dus wat een dag
  in het programma deed, doet hij na de migratie nog steeds.
- Slaap en energie vervallen. Er is geen eerlijke vertaling naar benen of pijn, en een
  verzonnen waarde zou twee weken lang de deloadtelling sturen. Een dag met alleen slaap
  en energie heeft daarna geen dagcheck meer.
- Het veld `checkins` verdwijnt uit `UserState`.
- `migrateUser` maakt ook een bestand schoon dat zichzelf al v18 noemt maar rommel meedraagt
  (`normalizeDayCheck`): onbekende waarden en `sleep`/`energy` vallen eruit.

De echte Pages-export uit `tests/fixtures` (v14) laadt nog steeds; `overzetten.test.ts`
controleert nu dat de benen daaruit correct in de dagcheck landen.

### Gebruik

| Signaal | Wat het doet |
| --- | --- |
| benen zwaar | wat een check-in van 1–2 deed: 1 set minder, zwaar kuitwerk eruit, de optionele zaterdag uit; telt mee in de deloadtrigger; fietsvariant → rustige duurrit |
| pijn knie/heup | fietsvariant → rustige duurrit, met de regel "Lichte weerstand, cadans niet onder 85." |
| pijn (elke plek behalve *anders*) | in het sessiescherm één regel bij oefeningen die de plek belasten: "knie gemeld — kies eventueel een lichter gewicht". Niet blokkerend, geen gewichtsaanpassing |

**De tag per oefening** is geen nieuw lijstje: elke oefening heeft al `loads`, de gebieden
waarop de gevoeligheidsinstelling werkt. `knee_deep` → knie, `hip_deep`/`lateral_hip` →
heup, `lower_back` → rug, `shoulder` → schouder (`painSpotsFor` in `logic/dayCheck.ts`).
Achilles en kuit hebben geen plek in de dagcheck en leveren dus geen regel op; *anders*
ook niet.

De gemelde plek staat in de historie (blok "Gemelde pijn", valt weg als er niets is) en
gaat mee in de export — hij zit gewoon in `dayChecks`.

### Twee keuzes die ik zelf gemaakt heb

1. **De regel "check-in 3 = vandaag geen gewichtsverhogingen" is weg.** Op de schaal van
   drie is *normaal* de gewone dag; die de progressie laten blokkeren zou elke normale dag
   een rem maken. Zwaar remt de progressie ook niet (dat deed 1–2 vroeger ook niet); het
   haalt een set af.
2. **De deloadtrigger "dagcheck" blijft bestaan, op zware benen.** Hij stond op "slaap en
   energie samen ≤ 3". Die vragen zijn weg; zonder vervanging zou de trigger stil vervallen.
   Nu: twee weken op rij, met minstens twee ingevulde dagen per week, meer dan de helft
   van de dagen benen zwaar. De tekst zegt dat ook. Pijn telt hier niet mee — die gaat
   over één plek, niet over herstel. Wil je deze trigger liever helemaal kwijt, dan is
   dat één regel in `deloadTrigger`.

---

## 2. Vervangen door fietsen

### Waar het zit

- **Vandaag**: onder *Meer* bij een krachtsessie.
- **Plannen**: per krachtsessie een link *Fietsen* (vandaag en later). Plannen heeft geen
  *Meer*-blad; een link naast *Verplaatsen* en *Overslaan* is daar de bestaande vorm.
- **Sessiescherm**: naast *Verplaatsen* op de warming-upstap, en in het blad met de
  oefeningenlijst (het *Meer* van het sessiescherm).

Overal hetzelfde blad (`components/BikeSwapSheet.tsx`): het voorstel bovenaan met de reden
in één regel, de andere variant eronder. Eén tik op een van de twee en het is gebeurd.

Vervangen kan alleen vandaag of vooruit, en alleen zolang er van de sessie nog niets
gelogd is (`hasLoggedWork`: afgerond of één set afgevinkt). Een dag die voorbij is vul je
in of sla je over, zoals altijd.

### Wat vervangen opslaat

Drie dingen, en dat is bewust weinig:

| Waar | Wat |
| --- | --- |
| `skips["<datum>:strength"]` | `{ reason: 'fietsen', what: 'strength' }` — de nieuwe skip-reden "Vervangen door fietsen". Je kiest hem niet zelf, net als `ingehaald` |
| `overrides[datum].bikeSwap` | `{ variant, sessionKey, legFocused }` — de keuze, de vervangen sessie-id, en of die sessie beengericht was (vastgelegd op het moment van vervangen, voor de beenprioriteit) |
| `activities[]` (na afloop) | `{ type: 'fietsen', variant, replacesSession, minutes, distanceKm, … }` |

Er wordt **niets** geschoven: geen `moves`, dus de volgende beensessie blijft waar hij
stond, en omdat de sessie een skip heeft staat hij niet onder "Nog open" en is hij niet
op te pakken. Er wordt geen sessie gelogd, dus de streefgewichten, de opbouwteller en de
deloadtelling blijven precies zoals ze waren.

### De keuzeregel (`suggestVariant`, `bikeSuggestion`)

In deze volgorde:

a. dagcheck benen zwaar, pijn aan knie of heup, of in de twee dagen ervoor een dag met een
   beenbelasting op of boven "hoog" (3) → **rustige duurrit**;
b. anders, als de sessie beengericht is — benen A/B, of volgens de bestaande belastingsscore
   op of boven 3 (bij Anouc: full body B met de squat) → **kracht-duur**;
c. anders → **rustige duurrit**.

"De afgelopen 48 uur" is de dag ervoor en de dag daarvoor, op dezelfde `legLoadOn` als de
rest van de app — inclusief fietsritten.

### Ongedaan maken

Tot en met de dag zelf (en dus ook voor een vooruit geplande vervanging, tot die dag
voorbij is): de skip en de `bikeSwap` gaan weg, en de rit die er eventueel al stond
verdwijnt uit de activiteiten. Wat er daarna staat is exact de sessie van voor het
vervangen. Op Vandaag onder *Meer* van de fietstraining, in het fietsscherm onder *Meer*,
en op Plannen als *Terughalen*.

---

## 3. De varianten

| | Kracht-duur | Rustige duurrit |
| --- | --- | --- |
| opbouw | 10 in (licht, cadans 90) → 5 × [4 zwaar, cadans 75–85, 7/10] met 4 × 2 rustig ertussen → 5 uit | 5 in → 30 duur (licht–matig, cadans 85–95, 3–4/10, praten kan) → 5 uit |
| duur | 43 min | 40 min |
| deloadweek | 3 zware blokken, 31 min | ongewijzigd |

Nergens staat een cadans onder de 75. Bij zware benen of pijn aan knie/heup krijgt de
duurrit de regel "Lichte weerstand, cadans niet onder 85." — in het keuzeblad, bovenaan
het fietsscherm en in de tekst van het duurblok.

**Deload: 3 × 4 min in plaats van "alleen de duurrit".** Dat raakt het minste code: het is
één parameter in `bikeBlocks` (`hardBlocks(deload)`), en de keuzeregel, het blad en het
scherm hoeven niets te weten van een deloadweek. "Alleen de duurrit" had het blad een
tweede toestand gegeven en de keuzeregel een vierde tak. De beenbelasting schaalt mee
(1,8 in plaats van 3,0).

### De bloktimer

`blockAt(blocks, startedAt, now)` rekent uit in welk blok je zit uit de starttijd en de
klok — hetzelfde principe als de rusttimer (die bewaart een eindtijd, geen aftellend
getal). De starttijd staat in `localStorage` onder `trainingsapp.fietsrit.<profiel>.<datum>`,
dus ook een app die tussendoor herladen is vindt de rit terug. Bij `visibilitychange`
rekent het scherm meteen opnieuw.

Bij elke blokwissel:

- **geluid**: twee korte tonen via Web Audio (`components/bikeSound.ts`), hoger bij een
  zwaar blok. iOS staat geluid pas toe na een tik; de startknop (en elke tik op het scherm)
  zet het klaar;
- **visueel**: een okerbalk bovenaan met "Nu: Zwaar blok 2 van 5 · 4 min", vier seconden,
  plus het huidige blok in de lijst gemarkeerd.

Geen trilling. Stond het scherm uit over meerdere wissels heen, dan klinkt er bij
terugkomen één signaal en staat het juiste blok in beeld. Een beperking die blijft: met het
scherm uit draait er in een iOS-PWA geen JavaScript, dus het signaal komt pas als het
scherm weer aangaat. Dat was bij de rusttimer ook zo.

Kleuren: alleen bestaande tokens (`bg-accent`, `text-on-accent`, `text-accent`, `border-accent`,
`text-dim`/`faint`/`muted`/`ink`). Er is geen kleur bijgekomen.

---

## 4. Registratie en naleving

Afronden vraagt twee dingen: de duur (voorgevuld met de plan-duur) en optioneel de km. Geen
beoordeling en geen extra knoppen. De rit komt als activiteit in de historie met chip
"Vervangt kracht" en de variant in de samenvatting ("Fietsen 43 min · 18 km · kracht-duur").
Nog een keer afronden werkt dezelfde rit bij.

**Telt als uitgevoerd** (`countsAsDone`, `isRealSkip` in `logic/day.ts`):

- weekcijfers: *Sessies x / y* telt hem als gedaan, niet als weggevallen;
- dagregel op Week: een vinkje zodra de dag voorbij is, titel "Fietsen (kracht-duur)";
- streak: verlengt, in plaats van neutraal te blijven zoals een skip;
- Historie: *Sessies* is afgeronde krachtsessies plus vervangen sessies;
- "Nog open" en oppakken: nooit, want de sessie heeft een skip.

Keuze: een vervangen sessie telt als uitgevoerd **ook als de rit niet geregistreerd is**.
De vervanging ís de handeling; de rit registreren is de administratie erbij. De minuten
tellen wel pas mee als ze geregistreerd zijn. Wie vervangt en het dan niet doet, draait
het die dag terug.

---

## 5. Meewegen in de training

### Beenbelasting

Op de bestaande schaal van `legLoad.ts` (de drempel "zware benen" is 3, "heel zwaar" 6):

| Sessie | Score |
| --- | --- |
| Benen A (Rob) | 9,19 |
| Benen B (Rob) | 8,98 |
| Benen A / B in de deloadweek | 3,85 / 3,72 |
| Full body B (Anouc) | 5,76 |
| Full body A (Anouc) | 2,82 |
| **Kracht-duur** | **3,0** (0,6 per zwaar blok) |
| **Kracht-duur, deloadweek** | **1,8** |
| **Rustige duurrit** | **1,0** |
| **Losse fietsrit** | 1,0, of 3,0 met "zwaar voor de benen" |

Kracht-duur staat precies op de drempel: "matig beenzwaar" — een derde van een echte
beensessie, maar genoeg om naast een beendag als zware dag te tellen. De duurrit is licht.
Fietsen en spinning tellen allebei als fietsen. De score hangt niet af van de minuten: een
rit van 60 minuten duurrit weegt als een duurrit.

Een vervanging die nog gereden moet worden telt al met de gekozen variant (zoals een
geplande krachtsessie meetelt voor hij gedaan is); is hij gereden, dan telt de rit en niet
nog eens de planning. De krachtsessie zelf telt dan uiteraard niet meer.

Een losse fietsactiviteit krijgt in het formulier één optionele keuze: "Zwaar voor de
benen" (`Activity.heavy`). Alleen bij fietsen en spinning.

### ⚠ De waarschuwing "zware benen vóór duurloop" bestaat niet meer

De opdracht zegt dat die op de belastingsscore draait en dat kracht-duur binnen 48 uur
vóór de duurloop hem moet kunnen triggeren. **Die waarschuwing is in `f178e68` ("Hardlopen
uit het advies") uit de app gehaald**, samen met het weekplafond en de opbouwlijn; de
migratie naar v16 ruimde de weggeklikte versies ervan op. Dezelfde opdracht zegt ook:
"Hardlopen blijft onaangeroerd: de app stuurt niet op hardlopen."

Ik heb hem **niet** teruggezet: dat zou een regel over de loop terugbrengen die bewust is
weggehaald, en die afweging hoort niet in een fietsronde. Wat er wél is:

- de enige overgebleven beenwaarschuwing, **twee dagen zwaar beenwerk achter elkaar**
  (`legStackAround`), draait op dezelfde score. Kracht-duur (3,0) haalt de drempel, dus
  kracht-duur op donderdag vóór benen B op vrijdag geeft nu "Twee dagen zwaar beenwerk
  achter elkaar: Fietsen (kracht-duur) op … en Benen B op …". Getest in
  `fietsen.test.ts` → "de beenwaarschuwing na kracht-duur";
- kracht-duur telt mee in "zwaar beenwerk in de afgelopen 48 uur" voor de keuzeregel.

Wil je de duurloopwaarschuwing terug, dan is het een losse beslissing; de score die hij
nodig heeft rekent fietsen nu al mee.

### Fiets-km en hardlopen

`runningLoad.ts` telt alleen looplogs zonder `bike` en losse activiteiten van het type
`hardlopen`. Fietsritten komen dus niet in de weekkilometers, het rollend gemiddelde, de
langste loop of de weekreeks — getest met een vervangende rit van 25 km en een losse rit
van 40 km. De weekrichtlijn en de duurloopopbouw bestaan sinds `f178e68` niet meer.

### Week en statistieken

Week: een kolom *Fietsen x min* verschijnt zodra er die week gefietst is (vervangende en
losse ritten samen; de bestaande "loop vervangen door 30 min fietsen" is een looplog en
blijft buiten deze telling). De signalen voor het advies op de server (`server/src/
signalen.ts`) krijgen per week `fietsMinuten` en `vervangenDoorFietsen`, en een vervanging
staat niet meer in de lijst `overgeslagen`.

### Beenprioriteit

`legPriorityNote`: bij `count` of meer beengerichte sessies die in de laatste `days` dagen
(tot en met vandaag) door fietsen vervangen zijn, staat er op Vandaag bij *Bijgestuurd*:

> 2 beensessies vervangen door fietsen in 14 dagen — fietsen vervangt geen zwaar beenwerk.

Niet blokkerend, geen knop. "Beengericht" is wat bij het vervangen is vastgelegd
(`bikeSwap.legFocused`). Configureerbaar per profiel via `settings.bikeLegPriority`:
`{ count: 2, days: 14 }` voor Rob, `null` (uit) voor Anouc. Er is geen schakelaar in
Instellingen voor gekomen; het staat in de startinstellingen van het profiel
(`store/settings.ts`) en gaat mee in export en import. Bestaande gebruikers krijgen de
waarde van hun profiel bij het laden.

---

## 6. Export en import

De export is nog steeds de hele staat. **Nieuw of gewijzigd ten opzichte van v17:**

| Veld | Wat |
| --- | --- |
| `schemaVersion` | 18 |
| `users.*.dayChecks[datum]` | nu `{ legs?, pain? }`; `sleep` en `energy` zijn weg |
| `users.*.checkins` | **weg** (opgegaan in `dayChecks.legs`) |
| `users.*.skips[..].reason` | nieuwe waarde `'fietsen'` |
| `users.*.overrides[datum].bikeSwap` | `{ variant, sessionKey, legFocused }` |
| `users.*.activities[].variant` | `'kracht_duur' \| 'duurrit'`, alleen bij een vervangende rit |
| `users.*.activities[].replacesSession` | sessie-id van de vervangen krachtsessie |
| `users.*.activities[].heavy` | `true` bij een zware losse fietsrit |
| `users.*.settings.bikeLegPriority` | `{ count, days }` of `null` |

Import van een oudere export werkt: v17 en ouder lopen door de migratie (getest met een
v17-bestand en met de echte v14-export). Een onbekende skip-reden wordt nog steeds
weggegooid; `fietsen` blijft.

### ~/trainingsreview — niet aangeraakt, wel gelezen

`review.py` (`KNOWN_SCHEMA = 14`) op een v18-export:

| Wat het leest | Wat er gebeurt |
| --- | --- |
| `schemaVersion` | logt "let op: export heeft schemaVersion 18"; gaat door |
| `dayChecks[..].sleep` / `.energy` | `.get()` geeft `None`, `getal()` maakt er 0 van, `gemiddelde()` laat nullen weg → `slaap_gem` en `energie_gem` worden `None`. **Loopt niet stuk**, maar die twee zijn voortaan altijd leeg |
| `dayChecks[..].legs` / `.pain` | genegeerd |
| `checkins` | ontbreekt → `benen_gem` altijd `None` |
| `activities` | alleen `type == 'hardlopen'`; fietsritten (ook `variant`, `replacesSession`, `heavy`) genegeerd |
| `skips` | `'strength: fietsen'` komt in `overgeslagen` — **verkeerd geteld** (het is geen overslaan), maar geen crash |
| `overrides`, `settings.bikeLegPriority` | niet gelezen |

Kortom: de parser **negeert** alles wat nieuw is en **loopt nergens op stuk**, maar hij
verliest de benen (die stonden in `checkins`), rapporteert slaap en energie als leeg, en
telt een vervanging als overgeslagen. Dat is de losse ronde.

---

## 7. Tests

Drie nieuwe bestanden, 75 tests:

- `dagcheck.test.tsx` (15) — migratie v17 → v18 (de schaal 1–5 naar drie woorden, slaap en
  energie weg, `checkins` weg, rommel in een v18-bestand, idempotent), de pijnregel per
  oefening en in het gerenderde sessiescherm (wel bij knie op de leg press, niet bij
  schouder, niet zonder pijn, en de sessie blijft identiek), plek in historie en export;
- `fietsen.test.ts` (45) — de keuzeregels a/b/c (ook via de belastingsscore bij Anouc),
  vervangen, ongedaan maken (zelfde dag wel, dag erna niet), de skip-reden, naleving en
  streak, streefgewichten ongewijzigd, schema niet geschoven en niet in "Nog open", deload
  ongewijzigd, beenbelasting van elke soort rit, de beenwaarschuwing na kracht-duur,
  fiets-km buiten het hardlopen, beenprioriteit (drempel, venster, alleen beengericht, per
  profiel), deloadvariant, de bloktimer uit de klok, export/import;
- `fietsenScherm.test.tsx` (15) — keuzeblad, Vandaag, "Nog open", beenprioriteit op
  Vandaag, sessiescherm, Plannen, het fietsscherm (blokken, hervatten na scherm-uit via de
  bewaarde starttijd, deload, de cadansregel), week en historie.

Bestaande tests die over `checkins` of slaap/energie gingen zijn omgezet naar de nieuwe
dagcheck; ze testen hetzelfde gedrag (een set minder, zaterdag uit, deload na twee slechte
weken, profielen gescheiden, export-roundtrip). De test "check-in 3 meldt geen verhogingen"
is vervangen door "normaal en fris draaien het gewone programma, zonder melding".

## 8. Wat ik niet gedaan heb

- De duurloopwaarschuwing niet teruggezet — zie §5.
- Geen instelling in het Instellingenscherm voor de beenprioriteit — het staat per profiel
  in de data.
- `~/trainingsreview` niet aangepast.
- Niet gepusht.
