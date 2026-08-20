# Herontwerp — verslag (augustus 2026)

Branch `herontwerp`, vertrokken vanaf `review-verbeterronde`. Alle tests groen (817),
productiebuild slaagt. De trainingslogica is niet aangeraakt.

## Wat er gewijzigd is

### Deel 1 — twee features eruit (schema v13)

Eiwitregistratie en dagelijks onderhoud zijn volledig verwijderd: de kaarten op
Vandaag, de instellingenkaart, de acties (`setProtein`, `toggleMaintenance`,
`add/removeMaintenanceItem`), de statistiek (`proteinGoal`, `maintenanceStreak`) en de
velden `protein`, `maintenance`, `Settings.maintenanceItems` en
`Settings.proteinFactor`. Migratie **v12 → v13** ruimt die velden op uit bestaande
localStorage-data en oude importbestanden; al het andere blijft staan (eigen
migratietests). De dagcheck (slaap/energie) is gebleven — die voedt de
deloadbeslissing. Isolatie- en herlaadtests die eiwit als bewijsmateriaal gebruikten,
gebruiken nu de check-in; de dekking zelf is gelijk gebleven.

### Deel 2 — het ontwerpsysteem

- **Eén tokenbestand**: `src/theme.css` bevat alle kleuren, de hoekmaat (4px) en de
  hairline-dikte (0,5px), voor donker én licht. `tailwind.config.js` verwijst
  uitsluitend naar die variabelen; de standaardpaletten zijn weg, dus een
  hardgecodeerde kleurklasse compileert simpelweg niet meer.
- **Monochroom**: negen tinten (bg, raised, fg, muted, faint, line, on-invert,
  scrim) plus één semantische kleur `--c-error`, alleen voor echte fouten en de
  wisknoppen. De primaire actieknop is massief in de voorgrondkleur.
- **Typografie**: twee gewichten (400/500). Labels klein, gedempt, kleine letters
  met ruime letterafstand (`.label`). Alle cijfers via `.num` in monospace
  (SF Mono-stack) met tabular numerals.
- **Hairlines in plaats van kaartjes**: `.card` is een sectie met een 0,5px-lijn
  erboven; alleen `.frame` (de actieve sessie) heeft een echte omkadering. Chips
  zijn monochrome hairline-labels zonder toonvarianten. Grafieken en de
  oefenpoppetjes tekenen met de tokens.
- **Donker/licht**: donker is het uitgangspunt, licht een volwaardige tweede modus.
  Schakelaar in Instellingen (volg systeem / donker / licht); de keuze staat per
  toestel in zijn eigen localStorage-sleutel en wordt door een inline script in
  `index.html` vóór de eerste paint gezet, dus geen flits. `theme-color` van de
  browserbalk beweegt mee. Eigen tests in `tests/theme.test.ts`.

### Deel 3 — de schermen

- **Week** (leidend voorbeeld): drie weekcijfers in een raster met
  scheidingslijnen (gelopen km tegen het plafond, sessies afgerond/gepland,
  tilvolume), daaronder zeven dagregels met dagafkorting in monospace, de
  sessienaam, een streepje waarvan de breedte de beenbelastingsscore weergeeft, en
  rechts een ✓ of een ⋯. Vandaag heeft een licht afwijkende achtergrond, het
  verleden is gedempt. De ⋯ opent een actielijst (DaySheet) met sessie openen en
  loop/kracht apart verplaatsen.
- **Vandaag**: de sessie van vandaag is het enige omkaderde blok, met de
  kerncijfers (km, geschatte minuten, oefeningen) in een raster bovenin.
  Waarschuwingen en bijsturingen zijn korte gedempte regels met een ▲. Daaronder de
  resterende dagen van de week als lijstregels. Check-in en dagcheck klappen
  ingevuld in (dat gedrag bestond al).
- **Sessie**: één set tegelijk groot en bewerkbaar — kg en reps als twee grote
  monospace-velden naast elkaar, komma-invoer zoals overal, RIR-rij eronder en één
  primaire knop "Set opslaan". Afgeronde sets krimpen tot één regel (tikken opent
  ze weer), komende sets staan gedempt voorgevuld klaar. De rusttimer is een
  rustige regel; "Sessie afronden" wordt pas primair als alle oefeningen af zijn.
- **Tabbalk**: tekstlabels, actieve tab met een lijn eronder.
- **Voortgang/Meekijken**: tellers in hetzelfde raster-met-hairlines;
  grafieken monochroom (deloadweek = lichtere balk).

## Eigen ontwerpbeslissingen waar de opdracht ruimte liet

1. **Destructieve acties in de foutkleur.** "Semantische kleur alleen bij een echte
   fout" — de knoppen voor gegevens wissen en de deload overslaan houden de rode
   kleur. Definitief verlies of bewust risico leek me precies de categorie waar die
   kleur voor bestaat.
2. **Het ▲-markeringsteken** voor waarschuwingen en bijsturingen, overal hetzelfde
   (Vandaag, Week, verplaatslijst, sessiescherm).
3. **De ⋯ per dagregel opent een actielijst** in plaats van knoppen per rij; loop en
   kracht houden daarin elk hun eigen verplaatsknop. De verplaats-tests toetsen
   dezelfde garanties via die actielijst.
4. **De belastingsstreep** is genormaliseerd op de "zeer hoog"-drempel van de
   beenbelastingsscore (score 6 ≈ maximale breedte), afgetopt op 100%.
5. **De themavoorkeur reist niet mee in een export**: hij hoort bij het toestel,
   zoals de systeeminstelling zelf. Daarom een losse sleutel en geen schemawijziging.
6. **De optionele zaterdagsessie telt in "sessies x/y" pas mee als hij gedaan is**,
   anders staat er elke week een onhaalbaar gepland totaal.
7. **RIR-rij blijft in de seteditor** (compact, 44px): de spec noemde hem niet, maar
   de progressie leest hem, dus weglaten zou gedrag slopen.
8. **Vinkje bij een dag betekent "alles gedaan óf bewust overgeslagen"** — een
   overgeslagen sessie staat als "(overgeslagen)" in de regel zelf.
9. **`fmtKm`/getalnotatie**: overal Nederlandse komma, ook in invoervelden en
   placeholders.

## Zelf nalopen op het toestel

1. **Beide modi**: Instellingen → Weergave → wissel systeem/donker/licht. Let op de
   eerste paint (geen flits), de kleur van de statusbalk, en of hairlines op jouw
   scherm zichtbaar genoeg zijn (0,5px op een niet-retina-scherm kan wegvallen).
2. **Sessiescherm in de praktijk**: het één-set-tegelijk-ritme — set invullen, "Set
   opslaan", volgende set staat klaar. Controleer of het teruggaan naar een eerdere
   set (tik op de regel) natuurlijk voelt, en of de grote velden met zweterige
   duimen prettig werken.
3. **Weekscherm**: klopt het belastingsstreepje gevoelsmatig met hoe zwaar de
   sessies zijn, en is het vinkje/⋯-onderscheid duidelijk genoeg?
4. **Contrast van `faint`** (komende sets, dagafkortingen, voetnoten): bewust vaag,
   maar in fel zonlicht in de gym mogelijk té — zeg het als het onleesbaar is, dan
   schuift de token op.
5. **Migratie**: open de app één keer met je bestaande data en controleer dat alles
   er nog staat (sessies, loops, streefgewichten) en dat de eiwit/onderhoudskaarten
   weg zijn. Maak vooraf een export voor de zekerheid.
6. **De ⋯-actielijst** op de weekregels: staat alles erin wat je op een dag nodig
   hebt, of mis je er iets (bv. loop afvinken vanaf het weekscherm — bewust
   weggelaten, loggen gebeurt op Vandaag)?

## Bugs in de trainingslogica

Geen gevonden in deze ronde.
