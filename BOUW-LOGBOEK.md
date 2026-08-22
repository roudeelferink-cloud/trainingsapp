# Bouwlogboek — Logboek-ontwerp

Branch `logboek-ontwerp`, vanaf `main`. Vijf commits, één per stap, elk met groene
tests en een werkende productiebuild. Niet gepusht, niet gemergd.

| Commit | Wat |
|---|---|
| `909a730` | Tokensysteem, beide thema's, de twee fonts lokaal |
| `e55fbe8` | Vandaag |
| `c824166` | Week |
| `a578380` | Sessie |
| `10ae48e` | Navigatie, Historie en Instellingen |

Je kunt op elke tussenstand terug: `git checkout <hash>` en de app doet het daar.

---

## Wat er gebouwd is

### Het tokensysteem

Alles wat een kleur, een maat, een lettergrootte of een afstand is, staat in
**`src/theme.css`** als custom property — de kleuren van beide thema's, de complete
typografieschaal, de spacing en de maten uit de README. `tailwind.config.js` hangt er
alleen namen aan en bevat zelf geen enkele waarde. Componenten gebruiken die namen
(`text-display`, `bg-accent-wash`, `h-stepper`, `py-segment-y`).

Er staat nergens meer een hexwaarde of een px-getal in een component; ook de
grafieken en het stokpoppetje tekenen met tokens, zodat ze meekleuren met het thema.
Twee tests bewaken dat via de tokens in plaats van via een klasse: het invoerveld
blijft breed genoeg om te lezen, en de steppers blijven minstens zo groot als een
tapdoel.

De harde eisen staan er letterlijk in: geen `border-radius`, geen `box-shadow`,
steppers 64px, de primaire actie in de onderste 40% van het scherm, Nederlandse
komma in getallen (en een smalle spatie als duizendtalscheiding: `8 240 kg`).

### Thema's

Donker is de standaard; licht heeft alle afwijkingen uit de README, inclusief de
belangrijke: de primaire knop is daar zwart met papierkleurige tekst in plaats van
oker. De schakelaar staat bij **Instellingen → Weergave** met drie keuzes, en
**"Systeem" is de standaard**.

De keuze staat in een eigen localStorage-sleutel (`trainingsapp.theme`) en **niet in
de app-state**. Welk thema dit toestel toont hoort niet bij je trainingsgeschiedenis
en niet in de back-up. Het datamodel is dus ongemoeid gebleven.

### Fonts

Newsreader (roman + italic) en Archivo staan als woff2 in `src/fonts` en worden door
Vite gebundeld — geen runtime-fetch, dus de app werkt offline in een kelder. De
service worker neemt ze mee (precache is nu ~700 KB in plaats van ~390 KB; dat is de
prijs van twee variabele fonts).

Alleen de latin-subset is meegenomen; die dekt het volledige Nederlands, inclusief
`é` en `ë`. Zie de kanttekening over glyphs onderaan.

### De schermen

**Vandaag** is één pagina in plaats van een stapel kaarten: datumregel met de
programmamarkeringen rechts, de kop van de dag (het grote cijfer bij een loop, de
sessienaam bij kracht), de kerncijfers tussen twee haarlijnen, het bijsturingsblok,
de check-in, de tweede sessie van de dag, de extra activiteiten, en onderin de
actiezone.

**Week** heeft de weekkop met bereik en markeringen, drie weekcijfers, de
plafondbalk met de reden eronder, en zeven dagregels van gelijke bouw. Vandaag heeft
een okerrand boven en onder met de wash die tot in de gutter loopt; afgeronde dagen
uit het verleden zakken weg tot een vinkje.

**Sessie** doet één ding tegelijk: eerst de warming-up, dan oefening voor oefening,
met bovenaan de voortgangssegmenten. Per oefening de setrijen en onderin één paar
steppers voor de set die aan de beurt is. De knop volgt het ritme: "Set n klaar" →
"Volgende oefening" → "Sessie afronden".

**Historie** en **Instellingen** waren volgens de README vrij; ze volgen de vorm van
Week — een kop, cijfers tussen haarlijnen, en blokken met een kapitaal-label.

---

## Waar het ontwerp niet klopte met de app

### 1. De navigatiebalk — opgelost met drie tabs plus een regel op Historie

De balk heeft nu precies de drie labels uit het ontwerp: **Vandaag / Week /
Historie**, gelijke breedte, kapitaal, met een 2px okerlijn boven de actieve tab.
Voortgang heet Historie: dat is wat het scherm laat zien en wat het ontwerp die plek
noemt.

**Instellingen staat bewust niet in de balk.** Die balk is van wat je elke dag doet;
pincode, profiel, stanggewichten en de back-up raak je hooguit een keer per maand
aan. Ze zitten achter de regel **"Instellingen"** rechtsboven op Historie en openen
als eigen scherm over de app heen, met `← Historie` terug.

De afweging: een vierde tab maakt de andere drie smaller en zet een maandelijkse
handeling naast een dagelijkse. Twee tikken naar iets dat je zelden nodig hebt vond
ik de betere ruil. Alles blijft volledig bereikbaar — inclusief profielwissel,
meekijken, export/import en gegevens wissen.

### 2. Zone 2 en de loopopbouw in segmenten — weggelaten

**De app kent deze gegevens niet.** Er is geen zonebegrip in het datamodel, en er is
geen *gepland* tempo: `paceMinPerKm` rekent achteraf uit wat je gelopen hébt, en de
programma's schrijven expliciet "hardlopen in eigen tempo". Er is ook geen
segmentstructuur — een `RunBlock` heeft één afstand, geen inlopen/tempo/uitlopen.

Dus: het blok "Opbouw van de loop" is er niet, en de kolom "Zone" ook niet. Ik heb
geen tempo's verzonnen.

De drie kerncijferkolommen zijn in plaats daarvan gevuld met wat de app wél weet, en
verschillen daarom per soort dag:

- **loopdag** — Deze week (gelopen / plafond), Gepland (alleen als de afstand is
  bijgesteld), Streak
- **krachtdag** — Duur, Oefeningen, Streak
- **rustdag of lege dag** — alleen Streak

Kolommen zonder gegeven worden niet gerenderd; er wordt geen lege ruimte
gereserveerd.

### 3. De bijsturingsnotitie — bestaande guardrails in die vorm

Het blok staat er, met het accent-kapitaal **BIJGESTUURD** en de tekst in cursieve
serif, precies zoals ontworpen. De inhoud zijn de **bestaande** meldingen: de
guardrails uit `dayGuardrails`, de dagnotities uit `buildDay`, en de redenen achter
de loopafstand (`run.why`). Letterlijk overgenomen — er is geen enkele coachtekst
gegenereerd.

Eén toevoeging op het ontwerp: waar een melding iets op te lossen heeft, staat de
knop eronder ("Verplaatsen", "Niet meer tonen"). Het ontwerp toont daar alleen
proza, maar een waarschuwing zonder uitweg is een verwijt. Ze staan als okeren
tekstknoppen, dus het blok blijft rustig.

Is er niets bij te sturen, dan valt het blok volledig weg.

---

## Ontwerpbeslissingen die ik zelf genomen heb

**De actiezone kan maar twee knoppen dragen, de app heeft er meer.** Vandaag had per
sessie vier tot vijf acties (fiets, afstand aanpassen, verplaatsen, overslaan, korte
versie). De primaire knop is nu de hoofdactie en de knop ernaast heet **"Meer"** en
opent een blad met de rest. Zo blijft het duimbereik schoon en gaat er niets
verloren. Gevolg: "Geplande afstand aanpassen" zit één tik dieper dan vroeger.

**De check-in is één blok geworden.** Het ontwerp toont Slaap en Energie op een
schaal van drie. De app heeft daarnaast "Benen en pezen" op een schaal van vijf, en
dat cijfer stuurt het programma van vandaag. Die staat nu als derde rij in hetzelfde
blok, met dezelfde segmenten en de bestaande voetnoot ("1 = brak · 5 = fris"). Je
vult ze in één beweging in, dus horen ze bij elkaar. De rijen zijn direct
opgeslagen, zonder bevestigknop, zoals het ontwerp voorschrijft.

**De programmamarkeringen staan rechtsboven.** Deloadweek, kalibratie en reismodus
waren gekleurde chips in de oude kop. Er is nog maar één accentkleur, dus ze staan nu
als gestapelde kapitaalregels onder het weeknummer — dezelfde vorm die het ontwerp op
Week gebruikt voor `DELOAD OVER 5 WK`.

**Een dagregel op Week heeft geen knoppen; de regel ís de knop.** Valt er één ding te
doen, dan gebeurt dat meteen. Zijn het er twee (de loop verplaatsen én de sessie
openen), dan vraagt de app eerst welke — anders is niet te zien wat je aantikt.

**De sessie begint bij de warming-up.** Die is de eerste stap in de voortgangsbalk,
niet een zevende oefening. Alles wat de app aan de sessie bijstuurt (kalibratie,
guardrails, een sessie boven het uur, de volgorde) staat op die stap: dat lees je aan
het begin, niet halverwege.

**"Sla over" slaat een set over, niet de oefening.** Zoals het ontwerp zegt: de set
blijft niet-afgevinkt en telt niet mee in het volume. Een hele oefening overslaan zit
nog steeds achter "Aanpassen".

**RIR staat als vierde rij onder de steppers.** Het ontwerp toont RIR alleen als
status op een afgeronde rij, maar in de app stel je hem per set in en voedt hij de
progressie. Hij gebruikt dezelfde segmentvorm als de check-in.

**Rood en groen zijn weg.** Er is één accentkleur. Waar kleur betekenis droeg —
gevoelige gebieden (ok / let op / gevoelig), gegevens wissen — doet de tekst dat nu,
met precies dezelfde poortjes eromheen: de wisknop zit nog steeds achter een
dichtgeklapte sectie, een pincode, een bevestigingsvinkje en een blokkade na drie
foute pogingen. In de staafdiagrammen gaat het accent naar de deloadweken; de uitleg
zegt nu "Oker = deloadweek" in plaats van "Oranje".

**`.card` is een paginasectie geworden** — één haarlijn erboven, geen doos eromheen.
Daardoor lezen ook Instellingen, Onboarding en het meekijkscherm als één vel papier.

**Het verticale ritme is één token van 14px.** De README noemt 13–15px; één waarde
houdt het systeem eerlijk. De haarlijn onder de datumregel staat daardoor op 14/14 in
plaats van 13/15.

---

## Wat er niet gebouwd is, en waarom

- **Zone, gepland tempo, loopsegmenten** — de app kent die gegevens niet (zie boven).
- **De rusttimer die doorloopt als de app dicht gaat.** Het ontwerp vraagt om het
  bewaren van de eindtijd. Dat gebeurt ook — maar in geheugen, niet op schijf.
  Persistent maken vraagt een veld in de opgeslagen state, en dat mocht niet. Binnen
  de app blijft de timer kloppen (hij rekent met de klok, niet met een teller), ook
  als het scherm even uit is geweest; sluit je de app helemaal af, dan is hij weg.
- **Bevestiging bij het verlaten van een sessie.** Het ontwerp noemt "bevestiging als
  er onopgeslagen sets zijn". Die zijn er niet: de app schrijft bij elke wijziging
  een concept weg. Een dialoog die altijd "er is niets kwijt" zegt, is ruis.
- **De secties 1A / 1B / 1C en 2A** uit het ontwerpbestand — afgewezen richtingen en
  een oudere versie, zoals afgesproken.
- **De canvaslaag** (telefoonframes, ronde hoeken, schaduw) — dat is presentatie.

---

## Randvoorwaarden

- **Trainingslogica ongemoeid.** Niets in `src/logic/` of `src/store/` is inhoudelijk
  gewijzigd. Guardrails, deload, weekplafond, beenbelastingsscore, startgewichtadvies
  en schijfberekening doen precies wat ze deden. De enige toevoegingen aan `logic` zijn
  drie presentatiehelpers in `dates.ts` (`weekdayShort`, `dayNumber`, `formatRange`).
  **Ik ben geen bug in die logica tegengekomen.**
- **Datamodel ongewijzigd.** Geen veld erbij, geen migratie, schema blijft v13. De
  themakeuze staat buiten de app-state.
- **Geen nieuwe dependencies.** `package.json` is niet aangeraakt.
- **Tests:** 825 groen in 37 bestanden (waren er 813 in 36). Aangepast waar de DOM
  veranderde, zonder assertions te verzwakken — waar dat kon zijn ze juist sterker
  geworden: de steppermaten worden nu uit `theme.css` gelezen in plaats van uit een
  klassennaam, en "elke loop is te verplaatsen" test nu de `dayActions`-lijst in
  plaats van het aantal knoppen in de HTML. Nieuw: zeven tests voor de themakeuze en
  twee voor het sessieverloop.
- **Productiebuild slaagt**, inclusief PWA-precache van de fonts.

---

## Wat jij op je iPhone moet nalopen

Ik heb dit niet visueel kunnen controleren: op deze Pi ontbreken de systeem-
bibliotheken voor een headless browser, en die installeren vraagt sudo. Alles
hieronder is dus geverifieerd via tests en de build, niet met het oog.

1. **De twee fonts.** Laden Newsreader en Archivo echt? Als het grote cijfer op
   Vandaag er als een gewone systeemserif uitziet, komt het font niet binnen.
2. **De glyphs `←`, `→` en `✓`.** Die zitten niet in de latin-subset van deze fonts,
   dus iOS pakt er zijn eigen letter voor. Kijk of de weekpijlen en de vinkjes niet
   uit de toon vallen. Zo ja: laat het weten, dan bundel ik een bredere subset.
3. **Het lichte thema in de zon.** Zet Instellingen → Weergave op Licht en kijk of de
   zwarte primaire knop en de okeren markeringen genoeg contrast houden.
4. **Het duimbereik in de sportschool.** Staan de steppers en "Set n klaar" waar je
   duim rust, met de telefoon op een bankje? Dat is de eis waar het ontwerp om draait.
5. **De rusttimer.** Vink een set af, zet het scherm uit, wacht, en kijk of de tijd
   klopt als je terugkomt.
6. **De sessieflow van begin tot eind.** Warming-up → oefening 1 → alle sets →
   Volgende oefening → laatste oefening → Sessie afronden. Vooral: kom je op elke
   oefening waar je wilt zijn, en klopt de voortgangsbalk?
7. **De weg naar Instellingen.** Historie → "Instellingen" rechtsboven. Vind je dat
   snel genoeg, of wil je het ergens anders?
8. **De "Meer"-knop op Vandaag.** Zit alles erin wat je verwacht (fiets, afstand
   aanpassen, verplaatsen, overslaan)?
9. **Een dag met loop én kracht.** Staat de loop terecht als hoofdactie en de sessie
   als "Ook vandaag · … Bekijk"?
10. **Installeer hem opnieuw als PWA** en zet je vliegtuigmodus aan. De fonts moeten
    dan nog steeds goed staan.
