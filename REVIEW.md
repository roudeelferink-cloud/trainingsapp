# Review — zelfstandige verbeterronde (augustus 2026)

Volledige doorloop van alle schermen, flows en de code eronder. Elk punt kort onderbouwd.
De trainingslogica (guardrails, deload, weekplafond, beenbelasting, startgewicht, schijven)
is alleen gelezen, niet gewijzigd.

## Vooraf: bestaande testfout op `main`

`tests/screens.test.tsx` — *"laat de geplande loopafstand zien en aanpassen"* faalt al op
`main`, vóór deze ronde. De test zet `startDate` op de maandag van deze week en rendert
`Today`, maar verwacht dan **Duurloop 10 km** — die staat alleen op zondag. De test is
daarmee datumafhankelijk: hij slaagt alleen als de suite op een zondag draait. Geen bug in
de app, wel in de test. Opgelost door in die test de systeemklok op de zondag te zetten
(`vi.setSystemTime`); de assertions zelf zijn ongewijzigd.

## Uitstraling en UX

1. **"Wat moet ik nú doen" staat niet bovenaan.** Op Vandaag komen eerst twee invulkaarten
   (check-in 1–5 en de dagcheck slaap/energie) en dan pas de sessie van vandaag. De
   check-in stuurt het programma van vandaag en mag vooraan blijven, maar allebei de
   kaarten blijven op volle grootte staan, ook nadat ze ingevuld zijn. De dagcheck stuurt
   vandaag niets (hij voedt alleen de deloadbeslissing) en hoeft al helemaal niet boven de
   sessie. → check-in klapt in tot één regel zodra hij ingevuld is; dagcheck verhuist
   onder de sessiekaarten en klapt ook in.
2. **Focus-stijlen ontbreken.** Vrijwel alle knoppen hebben geen zichtbare focusstaat;
   invoervelden hebben `focus:outline-none` met alleen een randkleurtje. → globale
   `focus-visible`-ring in de basis-CSS.
3. **Decimale invoer werkt niet met een komma.** De getalvelden zijn `type="number"`; het
   Nederlandse iOS-toetsenbord toont een komma, en een komma in zo'n veld maakt de waarde
   leeg → de app maakt er 0 van. Daarnaast herformatteert `toFixed` het veld bij elke
   toetsaanslag ("4" wordt meteen "4.0"), wat typen vrijwel onmogelijk maakt. → tekstveld
   met `inputMode="decimal"`, komma én punt accepteren, en pas formatteren als het veld
   niet de focus heeft.
4. **Pinch-zoom staat uit.** `maximum-scale=1` in de viewport blokkeert inzoomen
   (toegankelijkheid). De reden — iOS zoomt in op velden onder 16px — is al afgedekt
   doordat alle velden 16px of groter zijn. → weggehaald.
5. **Sheets vergrendelen de achtergrond niet.** Bij een open onderblad scrolt de pagina
   erachter gewoon door (klassiek iOS-euvel) en de titel is niet aan de dialoog gekoppeld.
   → body-scroll-lock zolang een Sheet open is, plus `aria-labelledby`.
6. **De tabbalk gebruikt tekstglyphs (●, ▦, ↗, ⚙).** Die rendert iOS klein en ongelijk
   van gewicht, en de actieve tab is alleen aan kleur te zien. → inline-SVG-icoontjes,
   `aria-current` op de actieve tab.
7. **Scrollpositie blijft staan bij het wisselen van tab.** Van onderaan Vandaag naar
   Voortgang springen laat je midden in dat scherm landen. → naar boven scrollen bij
   tabwissel.
8. **Kleursemantiek is niet overal consistent.** De deload is amber in de weekchips en de
   grafieken ("Oranje = deloadweek"), maar `Chip tone="warn"` is rosé; een dalende 1RM
   krijgt dezelfde "warn" als een deloadweek. Niet storend genoeg voor een hele
   herkleuring; genoteerd, alleen de duidelijkste gevallen gelijkgetrokken.
9. **Herhaalde patronen zijn met de hand nagebouwd** (zie ook Codekwaliteit): het
   keuzerooster met accent voor de actieve knop staat er zeven keer, de
   bevestigingscheckbox met het rode vinkje twee keer, de "overgeslagen"-kaart twee keer.
   Zelfde gedrag, netto minder code, gegarandeerd zelfde uiterlijk. → gedeelde componenten.

## Bestaande functionaliteit — slimmer of met minder klikken

1. **Check-in invullen kost nu elke dag scrollwerk terug naar de sessie** — opgelost via
   punt 1 hierboven (inklappen).
2. **Lege staat "Geen sessie ingepland vandaag" is een doodlopende straat.** Er staat niet
   wanneer de volgende sessie is. → volgende geplande sessie (dag + wat) erbij tonen;
   puur afgeleide informatie, geen nieuw datamodel.
3. **Feedback bij opslaan is er grotendeels al** (draft-opslag per set, "Sessie
   opgeslagen", voortgangsbalk). Geen grote ingreep nodig; wel bleek de
   voortgangsindicatie "x van y afgerond / n sets" goed te werken — laten staan.
4. **De rusttimer start niet vanzelf na het afvinken van een set.** Automatisch starten
   scheelt een tik per set, maar is ook gedrag dat je moet kunnen uitzetten — en een
   instelling daarvoor raakt het opgeslagen `Settings`-model. → niet gebouwd, zie
   Voorstellen voor later.

## Ontbrekende mogelijkheden

Klein en gebouwd:

- **Volgende sessie in de lege staat van Vandaag** (zie hierboven).

Groter of raakt datamodel/logica → **Voorstellen voor later** onderaan.

## Codekwaliteit

1. **Dode code.** `dayScoreLabel` en `isDayScore` (feel.ts), `WARMUP_TYPE_LABEL`
   (warmup.ts) en `prescribesDistance` (runningLoad.ts) worden nergens gebruikt, ook niet
   in tests. → verwijderd.
2. **`DayOverride.runScale` wordt nergens geschreven.** `day.ts` leest hem
   (`override?.runScale ? … : scaled`), maar geen enkele actie zet hem. Dat is een dood
   datamodel-veld met een levende leestak. Verwijderen raakt het opgeslagen model en de
   dagopbouw → niet aangeraakt, hier gemeld.
3. **Acties zonder UI.** `reopenSession`, `setSessionFeel`, `undismissWarning` en
   `toggleCompleted` bestaan en zijn getest, maar geen scherm roept ze aan. Bewust laten
   staan (tests dekken ze; verwijderen zou assertions schrappen), maar het is de moeite
   waard er UI voor te overwegen — zie Voorstellen voor later.
4. **Herhaald keuzerooster.** Hetzelfde blok knoppen-met-accent (grid, actieve knop
   `bg-accent text-ink-900`, anders `bg-ink-700 border`) staat in CheckIn, DayCheck, twee
   FEELS-kiezers, warming-uptype, activiteitstype en -intensiteit. → één `ChoiceGrid` in
   `components/ui.tsx`.
5. **Herhaalde bevestigingscheckbox.** De rij met rood vinkje + `role="checkbox"` staat
   identiek in de deload-overslaan-dialoog en de wisdialoog. → één `ConfirmCheck`.
6. **Herhaalde "overgeslagen"-kaart.** RunCard en StrengthCard bouwen dezelfde kaart
   (naam + reden-chip + "Toch doen"). → één `SkippedCard` in Today.
7. **Getalnotatie is drie keer uitgevonden.** `fmt` (runningLoad), `fmtKm` (day),
   `fmtNumber` (activities) en `paceLabel` (Today) doen varianten van hetzelfde;
   `paceLabel` dupliceert bovendien de min/km-tak van `activityPace`. Samentrekken zou
   door de logica-bestanden heen woelen voor weinig winst → alleen de UI-kant opgeruimd
   (paceLabel hergebruikt), de rest genoteerd en bewust laten liggen.
8. **`tempoHint` (Activities.tsx) bouwt een nep-`Activity`** om `activityPace` te kunnen
   aanroepen. Werkt, maar het is een teken dat de functie een te zware invoer vraagt.
   Laten staan; opruimen zou de logica-API wijzigen.
9. **`Today.tsx` (836 regels) en `SettingsScreen.tsx` (789 regels) doen veel.** De
   deelcomponenten zijn er al wel (RunCard, StrengthCard, …); echte splitsing in
   bestanden is vooral verplaatswerk. Niet gedaan in deze ronde om de diff leesbaar te
   houden.

## Voorstellen voor later (niet gebouwd)

- **Rusttimer automatisch starten na het afvinken van een set**, met een aan/uit-knop in
  Instellingen. Levert: één tik minder per set, in de praktijk 15–20 tikken per sessie.
  Kost: nieuw veld in `Settings` (+ migratie of normalisatie) en gedragskeuzes (wat bij
  de laatste set van een oefening?).
- **Sessiehistorie terugkijken.** Een afgeronde sessie is nu alleen als geheel te openen
  via Vandaag/Week van die dag; er is geen lijst "vorige sessies" met sets per oefening.
  Levert: inzicht ("wat deed ik vorige week bij leg press?") precies op het moment van
  laden. Kost: nieuw scherm + navigatie; data is er al.
- **Beoordeling (feel) achteraf aanpassen** via de bestaande `setSessionFeel`. Levert:
  een vergeten of verkeerd getikte beoordeling herstellen. Kost: klein stukje UI, maar de
  progressie is dan al met de oude beoordeling gedraaid — dat verdient een bewuste keuze
  en hoort daarom niet in deze ronde.
- **Afgeronde sessie heropenen** via het bestaande `reopenSession`. Kost: afronden past
  progressie toe; nogmaals afronden zou dubbel kunnen sturen. Eerst uitzoeken hoe dat
  veilig kan.
- **Export via het iOS-deelblad** (`navigator.share` met bestand) naast de huidige
  download. Een blob-download in een standalone PWA op iOS is fragiel; delen naar
  Bestanden/AirDrop is robuuster. Kost: weinig code, maar alleen op het toestel zelf te
  verifiëren — daarom niet blind gebouwd.
- **`DayOverride.runScale` opruimen** (dood veld, zie Codekwaliteit 2): raakt het
  opgeslagen model, dus met migratie en verhoogde `SCHEMA_VERSION`.
- **Wake lock / doorlopende rusttimer.** De timer stopt zodra het scherm op slot gaat of
  de component unmount. Echt oplossen vraagt Wake Lock API of notificaties.

## Bugs in de trainingslogica

Geen gevonden die ik met zekerheid als bug durf te bestempelen. Het dode
`runScale`-leespad (Codekwaliteit 2) is het enige wat er tegenaan schuurt: het is
onbereikbare code, geen verkeerd gedrag.
