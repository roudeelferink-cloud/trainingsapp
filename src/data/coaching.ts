import type { Coaching } from '../types'

/**
 * Uitleg per oefening. Bewust concreet: geen "houd je rug recht" zonder te zeggen hoe.
 * Tempo staat in de uitvoering, geschreven als excentrisch-pauze-concentrisch.
 */
/**
 * Leg curl en leg extension zijn hier één zittende combimachine (incline), geen
 * losse prone leg curl. Wie van de ene naar de andere gaat, moet dus omstellen.
 */
export const LEG_COMBI_NOTE =
  'Leg curl en leg extension zijn dezelfde combimachine (zittend/incline). Stel het rolkussen om — boven je hielen voor de curl, aan de voorkant boven je enkels voor de extension — en zet de rugsteun en het heupkussen opnieuw goed.'

export const COACHING: Record<string, Coaching> = {
  /* ---------------- knee_dominant ---------------- */
  leg_press: {
    setup:
      'Rugleuning zo dat je onderrug volledig contact houdt. Voeten schouderbreed, midden op het platform, tenen 10-15° naar buiten.',
    execution: [
      'Zak in 3 tellen tot je knieën ongeveer 90° zijn of net voordat je bekken van de leuning komt.',
      'Duw in 1 tel terug via je hielen, knieën blijven boven je voeten wijzen.',
      'Stop 5-10° voor volledig gestrekt, zodat de spanning op je quadriceps blijft.',
    ],
    mistake: 'Zo diep zakken dat het bekken van de leuning kantelt en de onderrug bol trekt.',
  },
  smith_squat: {
    setup:
      'Stang op het bovenste deel van je schouderbladen, niet op je nek. Voeten schouderbreed en 10-20 cm vóór de stanglijn, zodat je verticaal kunt zakken.',
    execution: [
      'Adem in, span je buik aan en zak in 3 tellen tot je heup net onder je knie is.',
      'Duw in 1 tel omhoog, borst blijft op dezelfde hoek als bij het zakken.',
      'Knieën volgen de richting van je tenen, ook onderin.',
    ],
    mistake: 'Eerst de heupen omhoog schieten en de borst achterlaten, waardoor het een good morning wordt.',
  },
  smith_front_squat: {
    setup:
      'Stang op je voorste schouders, ellebogen hoog en naar voren. Voeten schouderbreed, iets vóór de stanglijn.',
    execution: [
      'Zak in 3 tellen recht naar beneden, ellebogen blijven de hele set hoog.',
      'Duw in 1 tel omhoog, romp zo verticaal mogelijk.',
      'Ga tot je knieën ongeveer 90° zijn of dieper als je ellebogen hoog blijven.',
    ],
    mistake: 'Ellebogen laten zakken, waardoor de stang naar voren rolt en je voorover klapt.',
  },
  hack_squat_smith: {
    setup:
      'Stang op je schouders, voeten duidelijk vóór de stanglijn zodat je achterover tegen de stang leunt. Hakken plat.',
    execution: [
      'Zak in 3 tellen, laat je knieën ver naar voren komen — dat is hier de bedoeling.',
      'Duw in 1 tel terug via je hele voet.',
      'Houd je rug tegen de stanglijn, zonder je bekken te kantelen.',
    ],
    mistake: 'Voeten te dicht onder de stang zetten, waardoor het gewoon een squat wordt.',
  },
  goblet_squat_kb: {
    setup:
      'Kettlebell verticaal tegen je borst, handen om de hoorns, ellebogen naar binnen. Voeten schouderbreed.',
    execution: [
      'Zak in 3 tellen tussen je knieën door, ellebogen langs de binnenkant van je knieën.',
      'Pauzeer 1 tel onderin zonder de spanning te lossen.',
      'Kom in 1 tel omhoog, kettlebell blijft tegen je borst.',
    ],
    mistake: 'De kettlebell van de borst laten wegkomen, waardoor je onderrug het werk overneemt.',
  },
  sandbag_squat: {
    setup: 'Schouderzak over één schouder of voor je borst geklemd, armen eromheen. Voeten schouderbreed.',
    execution: [
      'Zak in 3 tellen, de zak drukt je iets voorover — compenseer met je buikspanning.',
      'Duw in 1 tel omhoog via je hele voet.',
      'Wissel bij een zak op de schouder halverwege de set van kant.',
    ],
    mistake: 'De zak laten hangen in plaats van hem actief tegen je lijf te klemmen.',
  },
  leg_extension: {
    setup:
      'Zitten met je rug tegen de leuning, draaipunt van de machine op je kniegewricht, rolkussen net boven je enkels aan de voorkant.',
    execution: [
      'Strek in 1 tel je knieën tot bijna volledig gestrekt en knijp 1 tel aan.',
      'Laat in 3 tellen zakken tot net voor de startpositie; leg de schijven niet af.',
      'Houd je bekken op de zitting en je rug tegen de leuning.',
    ],
    mistake: 'Met een zwaai omhoog trappen of je billen van de stoel laten komen.',
    note: LEG_COMBI_NOTE,
  },
  squat_bw: {
    setup: 'Voeten schouderbreed, tenen licht naar buiten, armen recht vooruit als tegenwicht.',
    execution: [
      'Zak in 3 tellen zo diep als je kunt met je hakken op de grond.',
      'Pauzeer 1 tel onderin.',
      'Kom in 1 tel omhoog en knijp je bilspieren aan bovenin.',
    ],
    mistake: 'Op je tenen gaan staan onderin in plaats van je hakken op de grond te houden.',
  },
  wall_sit: {
    setup:
      'Rug plat tegen de muur, voeten een halve stap naar voren, knieën in 90°. Bovenbenen horizontaal.',
    execution: [
      'Druk je onderrug tegen de muur en houd de positie stil.',
      'Adem rustig door; reps zijn hier seconden.',
      'Verdeel het gewicht over je hele voet, niet alleen de hakken.',
    ],
    mistake: 'Steunen op je handen op de bovenbenen, waardoor de last uit je benen verdwijnt.',
  },

  /* ---------------- hip_dominant ---------------- */
  rdl_trapbar: {
    setup:
      'Sta in de trap bar, voeten heupbreed, handvatten midden in je hand. Knieën licht gebogen en de hele set in die hoek.',
    execution: [
      'Duw je heupen in 3 tellen naar achteren, stang schuurt langs je benen.',
      'Stop zodra je rek voelt in je hamstrings — meestal net onder de knie.',
      'Kom in 1 tel omhoog door je heupen naar voren te duwen, niet door je rug te strekken.',
    ],
    mistake: 'Door de knieën zakken in plaats van de heupen naar achteren duwen, waardoor het een squat wordt.',
  },
  rdl_barbell: {
    setup:
      'Stang tegen je bovenbenen, handen net buiten je heupen, voeten heupbreed. Knieën licht gebogen en zo houden.',
    execution: [
      'Heupen in 3 tellen naar achteren, stang blijft contact houden met je benen.',
      'Stop bij de rek in je hamstrings, rug in dezelfde hoek als bij de start.',
      'Kom in 1 tel omhoog en knijp je bilspieren aan bovenin.',
    ],
    mistake: 'De stang van het lichaam laten wegdrijven, waardoor de hefboom op je onderrug enorm toeneemt.',
  },
  leg_curl: {
    setup:
      'Zitten met je rug tegen de leuning, draaipunt van de machine op je kniegewricht, rolkussen net boven je hielen, heupkussen strak aangezet.',
    execution: [
      'Druk in 1 tel het kussen zo ver mogelijk naar beneden en knijp 1 tel aan.',
      'Laat in 3 tellen terugkomen tot net voor gestrekt.',
      'Rug tegen de leuning; duw niet mee met je romp.',
    ],
    mistake: 'Je bekken naar voren rollen of omhoog schuiven uit de stoel.',
    note: LEG_COMBI_NOTE,
  },
  hip_thrust_smith: {
    setup:
      'Schouderbladen op de rand van de bank, stang in de heupplooi met een kussen ertussen. Voeten zo dat je schenen verticaal staan bovenin.',
    execution: [
      'Duw in 1 tel je heupen omhoog tot romp en bovenbenen een rechte lijn vormen.',
      'Knijp 1-2 tellen je bilspieren aan bovenin, ribben omlaag.',
      'Zak in 3 tellen gecontroleerd terug zonder de grond te raken.',
    ],
    mistake: 'Bovenin doorschieten met de onderrug in plaats van te stoppen bij de rechte lijn.',
  },
  good_morning_smith: {
    setup: 'Stang op je schouderbladen, voeten heupbreed, knieën licht gebogen.',
    execution: [
      'Kantel in 3 tellen voorover vanuit je heupen tot je romp ongeveer 45° is.',
      'Houd je rug in dezelfde hoek van begin tot eind.',
      'Kom in 1 tel omhoog door je heupen naar voren te duwen.',
    ],
    mistake: 'Te ver doorzakken tot de rug bol trekt; ga niet verder dan waar je je rug vlak houdt.',
  },
  kb_swing: {
    setup:
      'Kettlebell een halve stap voor je, voeten iets breder dan heupbreed. Kantel voorover en pak hem met gestrekte armen.',
    execution: [
      'Zwaai de bel naar achteren tussen je benen door, onderarmen tegen je binnenbenen.',
      'Klap je heupen explosief naar voren; de bel vliegt vanzelf tot borsthoogte.',
      'Armen blijven ontspannen — je tilt niet, je zwaait.',
    ],
    mistake: 'De kettlebell met de schouders omhoog tillen in plaats van hem met de heupen weg te schieten.',
  },
  cable_pullthrough: {
    setup:
      'Kabel op de laagste stand, sta met je rug ernaartoe, touw tussen je benen door. Loop twee stappen naar voren voor spanning.',
    execution: [
      'Duw je heupen in 3 tellen naar achteren, armen blijven gestrekt en passief.',
      'Klap je heupen in 1 tel naar voren tot rechtop, bilspieren aanknijpen.',
      'Ga niet verder achterover dan rechtop.',
    ],
    mistake: 'Het touw met de armen naar voren trekken in plaats van met de heupen.',
  },
  nordic_curl_band: {
    setup:
      'Kniel op iets zachts, enkels vastgezet of vastgehouden. Band om je borst en achter je bevestigd voor ondersteuning.',
    execution: [
      'Laat je in 4-5 tellen zo langzaam mogelijk voorover zakken, heupen gestrekt.',
      'Vang jezelf op met je handen zodra je het niet meer houdt.',
      'Duw jezelf met je handen terug omhoog naar de startpositie.',
    ],
    mistake: 'De heupen laten knikken, waardoor je valt in plaats van excentrisch werkt.',
  },
  glute_bridge_bw: {
    setup: 'Op je rug, knieën gebogen, hielen ongeveer een handbreedte van je billen. Armen naast je.',
    execution: [
      'Duw in 1 tel je heupen omhoog tot een rechte lijn van knie tot schouder.',
      'Knijp 2 tellen je bilspieren aan bovenin.',
      'Zak in 3 tellen terug tot net boven de grond.',
    ],
    mistake: 'De beweging uit de onderrug halen door bovenin door te buigen.',
  },

  /* ---------------- push_horizontal ---------------- */
  bench_smith: {
    setup:
      'Ogen onder de stang, voeten plat op de grond, schouderbladen naar elkaar en omlaag. Greep iets breder dan schouderbreed.',
    execution: [
      'Laat de stang in 3 tellen zakken naar het onderste deel van je borst.',
      'Raak je borst zonder te stuiteren en duw in 1 tel omhoog.',
      'Ellebogen ongeveer 45° van je romp, niet recht opzij.',
    ],
    mistake: 'De schouderbladen laten losschieten aan de bovenkant, waardoor de schouders naar voren rollen.',
  },
  incline_db_press: {
    setup:
      'Bank op 30-45°, dumbbells op je knieën en met je knieën omhoog schoppen naar de startpositie. Schouderbladen ingetrokken.',
    execution: [
      'Laat in 3 tellen zakken tot je ellebogen net onder je schouders zijn.',
      'Duw in 1 tel omhoog en iets naar elkaar toe, zonder ze te laten tikken.',
      'Polsen recht boven je ellebogen houden.',
    ],
    mistake: 'De bank te steil zetten, waardoor het een schouderdruk wordt in plaats van borstwerk.',
  },
  flat_db_press: {
    setup:
      'Plat op de bank, dumbbells vanaf je knieën omhoog schoppen. Voeten plat, schouderbladen naar elkaar.',
    execution: [
      'Zak in 3 tellen tot je ellebogen iets onder banklijn zijn.',
      'Duw in 1 tel omhoog, dumbbells volgen een licht boogje naar elkaar toe.',
      'Ellebogen ongeveer 45° van je romp.',
    ],
    mistake: 'De dumbbells te ver naar je hoofd laten zakken, wat de schouders belast.',
  },
  floor_press_db: {
    setup:
      'Op je rug op de vloer, knieën gebogen, dumbbells boven je borst. Bovenarmen ongeveer 45° van je romp.',
    execution: [
      'Laat in 3 tellen zakken tot je bovenarmen de vloer raken.',
      'Pauzeer 1 tel op de vloer zonder de spanning te lossen.',
      'Duw in 1 tel omhoog.',
    ],
    mistake: 'Met de ellebogen van de vloer afstuiteren in plaats van de pauze te gebruiken.',
  },
  cable_chest_press: {
    setup:
      'Kabel op borsthoogte, sta met je rug ernaartoe in een split stance. Handvatten naast je borst, ellebogen achter je romp.',
    execution: [
      'Duw in 1 tel naar voren tot je armen bijna gestrekt zijn en breng je handen naar elkaar toe.',
      'Laat in 3 tellen terugkomen tot je rek voelt in je borst.',
      'Houd je romp stil; alleen je armen bewegen.',
    ],
    mistake: 'Met je bovenlichaam meeduwen om het gewicht in beweging te krijgen.',
  },
  pushup: {
    setup: 'Handen iets breder dan schouderbreed, vingers vooruit. Lichaam een rechte lijn van hoofd tot hiel.',
    execution: [
      'Zak in 3 tellen tot je borst een vuist boven de grond is.',
      'Duw in 1 tel omhoog en druk de grond van je af.',
      'Span je buik en bilspieren aan zodat je heupen niet zakken.',
    ],
    mistake: 'De heupen laten doorzakken of het hoofd vooruit steken om diepte te faken.',
  },
  pushup_decline: {
    setup: 'Voeten op de bank, handen iets breder dan schouderbreed op de grond. Lichaam in een rechte lijn.',
    execution: [
      'Zak in 3 tellen tot je borst vlak boven de grond is.',
      'Duw in 1 tel omhoog zonder je heupen te laten zakken.',
      'Hoe hoger je voeten, hoe zwaarder het wordt voor je schouders.',
    ],
    mistake: 'De heupen omhoog laten piekken, waardoor het een pike push-up wordt.',
  },
  band_chest_press: {
    setup:
      'Band achter je rug op schouderbladhoogte, uiteinden in je handen naast je borst. Split stance voor stabiliteit.',
    execution: [
      'Duw in 1 tel recht naar voren tot je armen bijna gestrekt zijn.',
      'Laat in 3 tellen terugkomen; de band trekt, dus rem actief af.',
      'Stap verder naar voren als de weerstand te licht is.',
    ],
    mistake: 'De band laten terugklappen zonder af te remmen, waardoor de helft van het werk wegvalt.',
  },
  triceps_pushdown: {
    setup:
      'Kabel hoog, greep op borsthoogte pakken. Ellebogen tegen je romp, romp een paar graden voorover.',
    execution: [
      'Strek in 1 tel je ellebogen volledig en knijp 1 tel aan.',
      'Laat in 3 tellen terugkomen tot je ellebogen ongeveer 90° zijn.',
      'Je bovenarmen blijven de hele set stil tegen je romp.',
    ],
    mistake: 'De ellebogen naar voren laten komen, waardoor je schouders het werk overnemen.',
  },
  skullcrusher: {
    setup:
      'Op de bank, curlstang met smalle greep boven je borst. Armen iets naar je hoofd gekanteld in plaats van verticaal.',
    execution: [
      'Buig in 3 tellen je ellebogen tot de stang net boven je voorhoofd is.',
      'Bovenarmen blijven in dezelfde hoek staan.',
      'Strek in 1 tel terug zonder de ellebogen helemaal op slot te zetten.',
    ],
    mistake: 'De bovenarmen mee naar achteren laten kantelen, waardoor het een pullover wordt.',
  },
  overhead_ext_db: {
    setup:
      'Zit of sta rechtop, één dumbbell met beide handen achter je hoofd. Ellebogen wijzen naar het plafond, dicht bij je oren.',
    execution: [
      'Laat in 3 tellen zakken tot je rek voelt in je triceps.',
      'Strek in 1 tel omhoog, ellebogen blijven op hun plek.',
      'Ribben omlaag houden zodat je onderrug niet holt.',
    ],
    mistake: 'De ellebogen naar buiten laten waaieren, wat de schouder belast en de triceps ontlast.',
  },
  close_grip_smith: {
    setup:
      'Greep op schouderbreedte, niet smaller — anders belast je je polsen. Ellebogen dicht langs je romp.',
    execution: [
      'Zak in 3 tellen tot de stang je onderste ribben raakt.',
      'Duw in 1 tel omhoog, ellebogen blijven binnen 30° van je romp.',
      'Polsen recht boven je ellebogen.',
    ],
    mistake: 'De handen te dicht bij elkaar zetten, waardoor je polsen knikken.',
  },
  bench_dip: {
    setup:
      'Handen op de bankrand naast je heupen, vingers vooruit. Benen gestrekt voor je uit, hoe verder hoe zwaarder.',
    execution: [
      'Zak in 3 tellen tot je bovenarmen horizontaal zijn, niet dieper.',
      'Duw in 1 tel omhoog, blijf dicht langs de bank.',
      'Borst omhoog en schouders omlaag houden.',
    ],
    mistake: 'Te diep zakken waardoor de schouders naar voren rollen; stop op horizontaal.',
  },
  band_pushdown: {
    setup:
      'Band boven je bevestigd, uiteinden in je handen op borsthoogte. Ellebogen tegen je romp.',
    execution: [
      'Strek in 1 tel je ellebogen en knijp 1 tel aan onderin.',
      'Laat in 3 tellen afgeremd terugkomen.',
      'Stap verder van het bevestigingspunt af voor meer weerstand.',
    ],
    mistake: 'Met de romp meebuigen om de laatste reps te halen.',
  },

  /* ---------------- push_vertical ---------------- */
  db_shoulder_press: {
    setup:
      'Bank rechtop of net iets achterover, dumbbells op schouderhoogte met de handpalmen vooruit. Voeten plat.',
    execution: [
      'Duw in 1 tel omhoog tot je armen gestrekt zijn, dumbbells eindigen boven je schouders.',
      'Laat in 3 tellen zakken tot je ellebogen net onder schouderhoogte zijn.',
      'Ribben omlaag houden, geen holle rug.',
    ],
    mistake: 'Doorbuigen in de onderrug om er extra reps uit te persen.',
  },
  smith_ohp: {
    setup:
      'Zit of sta met de stang op je sleutelbeenhoogte, greep iets breder dan schouderbreed. Sta zo dat de stanglijn langs je gezicht loopt.',
    execution: [
      'Duw in 1 tel omhoog en breng je hoofd er licht onderdoor als de stang je gezicht passeert.',
      'Laat in 3 tellen zakken tot sleutelbeenhoogte.',
      'Span je buik aan zodat je romp niet achterover kantelt.',
    ],
    mistake: 'Achterover leunen tot het een schuine bankdruk wordt.',
  },
  kb_press: {
    setup:
      'Kettlebell in de rekpositie: bel rust op je onderarm, pols recht, elleboog voor je ribben.',
    execution: [
      'Duw in 1 tel omhoog en draai je hand licht naar buiten onderweg.',
      'Laat in 3 tellen terug in de rekpositie zakken.',
      'Houd je pols recht — de bel mag niet aan je pols hangen.',
    ],
    mistake: 'De pols laten knikken onder het gewicht van de bel.',
  },
  sandbag_press: {
    setup: 'Zak voor je borst geklemd, ellebogen eronder. Voeten heupbreed, buik aangespannen.',
    execution: [
      'Duw in 1 tel omhoog tot de zak boven je hoofd is.',
      'Laat in 3 tellen terugzakken tot borsthoogte.',
      'De zak verschuift; blijf hem actief tegen je lijf klemmen.',
    ],
    mistake: 'De zak met een heupzwaai omhoog gooien in plaats van hem te drukken.',
  },
  lateral_raise_db: {
    setup:
      'Sta rechtop, dumbbells naast je heupen, ellebogen 10-15° gebogen en zo houden. Romp een paar graden voorover.',
    execution: [
      'Til in 1 tel opzij tot je ellebogen op schouderhoogte zijn, niet hoger.',
      'Leid met je ellebogen, niet met je handen.',
      'Laat in 3 tellen zakken tot net voor je heupen — spanning blijft erop.',
    ],
    mistake: 'Met een heupzwaai omhoog slingeren en het gewicht laten vallen.',
  },
  band_lateral_raise: {
    setup: 'Sta met beide voeten op het midden van de band, uiteinden in je handen naast je heupen.',
    execution: [
      'Til in 1 tel opzij tot schouderhoogte, ellebogen licht gebogen.',
      'Laat in 3 tellen afgeremd zakken.',
      'Sta breder op de band als hij te licht aanvoelt.',
    ],
    mistake: 'Boven schouderhoogte doorgaan, waardoor je schouders optrekken.',
  },
  pike_pushup: {
    setup:
      'Push-uppositie met je heupen hoog, lichaam in een omgekeerde V. Handen iets breder dan schouderbreed, hoofd tussen je armen.',
    execution: [
      'Zak in 3 tellen tot je kruin bijna de grond raakt.',
      'Duw in 1 tel omhoog tot je armen gestrekt zijn.',
      'Zet je voeten dichter bij je handen om het zwaarder te maken.',
    ],
    mistake: 'De heupen laten zakken, waardoor het een gewone push-up wordt.',
  },
  band_ohp: {
    setup: 'Beide voeten op het midden van de band, uiteinden op schouderhoogte in je handen.',
    execution: [
      'Duw in 1 tel omhoog tot gestrekt, handen eindigen boven je schouders.',
      'Laat in 3 tellen afgeremd zakken tot schouderhoogte.',
      'Ribben omlaag, geen holle rug.',
    ],
    mistake: 'Achterover leunen als de band bovenin zwaarder wordt.',
  },

  /* ---------------- pull_horizontal ---------------- */
  cable_row_low: {
    setup:
      'Zit rechtop, voeten tegen de steun, knieën licht gebogen. Pak het handvat en trek je schouderbladen omlaag.',
    execution: [
      'Trek in 1 tel naar je navel, ellebogen langs je romp.',
      'Knijp je schouderbladen 1 tel naar elkaar.',
      'Laat in 3 tellen terugkomen tot je schouderbladen naar voren rollen, romp blijft rechtop.',
    ],
    mistake: 'Met de romp naar achteren leunen om het gewicht te verplaatsen.',
  },
  bb_row: {
    setup:
      'Voeten heupbreed, kantel voorover tot je romp ongeveer 45° is. Stang hangt met gestrekte armen, greep iets breder dan schouderbreed.',
    execution: [
      'Trek in 1 tel naar je navel, ellebogen langs je romp.',
      'Laat in 3 tellen zakken tot je armen gestrekt zijn.',
      'Je romphoek blijft de hele set gelijk.',
    ],
    mistake: 'Bij elke rep omhoog komen met de romp, waardoor het een halve deadlift wordt.',
  },
  db_row_1arm: {
    setup:
      'Eén knie en één hand op de bank, andere voet op de grond. Rug horizontaal, dumbbell hangt onder je schouder.',
    execution: [
      'Trek in 1 tel naar je heup, elleboog langs je romp.',
      'Knijp 1 tel aan bovenin zonder je romp te draaien.',
      'Laat in 3 tellen zakken tot je rek voelt in je lat.',
    ],
    mistake: 'De romp meedraaien om de dumbbell hoger te krijgen.',
  },
  chest_supported_row: {
    setup:
      'Bank op 30-45°, borst tegen de leuning, dumbbells hangen naar de grond. Voeten voor stabiliteit.',
    execution: [
      'Trek in 1 tel omhoog, ellebogen ongeveer 45° van je romp.',
      'Knijp 1 tel je schouderbladen naar elkaar.',
      'Laat in 3 tellen volledig zakken.',
    ],
    mistake: 'De borst van de leuning tillen om meer gewicht te kunnen gebruiken.',
  },
  inverted_row_smith: {
    setup:
      'Stang op heuphoogte, hang eronder met gestrekte armen, hielen op de grond. Lichaam in een rechte lijn.',
    execution: [
      'Trek in 1 tel je borst naar de stang, ellebogen langs je romp.',
      'Laat in 3 tellen zakken tot je armen gestrekt zijn.',
      'Zet de stang lager om het zwaarder te maken.',
    ],
    mistake: 'De heupen laten zakken, waardoor je borst de stang niet haalt.',
  },
  face_pull: {
    setup:
      'Kabel op gezichtshoogte met touw. Stap achteruit voor spanning, armen gestrekt vooruit, duimen naar je toe.',
    execution: [
      'Trek in 1 tel naar je voorhoofd en draai je handen naar buiten.',
      'Ellebogen blijven op schouderhoogte of iets hoger.',
      'Laat in 3 tellen terugkomen, schouderbladen rollen mee naar voren.',
    ],
    mistake: 'Naar de borst trekken met lage ellebogen, waardoor het een roeibeweging wordt.',
  },
  band_face_pull: {
    setup: 'Band op gezichtshoogte bevestigd, uiteinden in beide handen. Stap achteruit tot er spanning staat.',
    execution: [
      'Trek in 1 tel naar je voorhoofd, ellebogen hoog en naar buiten.',
      'Knijp 1 tel je schouderbladen aan.',
      'Laat in 3 tellen afgeremd terugkomen.',
    ],
    mistake: 'De ellebogen laten zakken tot onder schouderhoogte.',
  },
  band_row: {
    setup:
      'Band om een vast punt op heuphoogte, uiteinden in je handen. Stap achteruit tot er spanning staat, knieën licht gebogen.',
    execution: [
      'Trek in 1 tel naar je navel, ellebogen langs je romp.',
      'Knijp 1 tel je schouderbladen naar elkaar.',
      'Laat in 3 tellen afgeremd terugkomen.',
    ],
    mistake: 'Achterover leunen als de band zwaarder wordt in plaats van stil te blijven staan.',
  },
  curl_bar_curl: {
    setup:
      'Curlstang met de schuine greep, handen op schouderbreedte. Ellebogen tegen je ribben, romp rechtop.',
    execution: [
      'Buig in 1 tel omhoog tot je onderarmen verticaal zijn.',
      'Laat in 3 tellen zakken tot bijna gestrekt.',
      'Je bovenarmen blijven stil; alleen je onderarmen bewegen.',
    ],
    mistake: 'De ellebogen naar voren laten komen, waardoor de spanning bovenin wegvalt.',
  },
  db_curl: {
    setup: 'Sta rechtop, dumbbells naast je benen, handpalmen vooruit. Ellebogen tegen je ribben.',
    execution: [
      'Buig in 1 tel omhoog en knijp 1 tel aan.',
      'Laat in 3 tellen zakken tot bijna gestrekt.',
      'Beide armen tegelijk of om en om, maar houd het tempo gelijk.',
    ],
    mistake: 'De romp naar achteren zwaaien om het gewicht op gang te helpen.',
  },
  hammer_curl: {
    setup: 'Dumbbells naast je benen met de handpalmen naar binnen, duimen omhoog. Ellebogen tegen je ribben.',
    execution: [
      'Buig in 1 tel omhoog, handpalmen blijven naar binnen wijzen.',
      'Laat in 3 tellen zakken tot bijna gestrekt.',
      'Polsen recht houden, niet knikken.',
    ],
    mistake: 'Halverwege de set naar een gewone curl draaien.',
  },
  cable_curl: {
    setup: 'Kabel op de laagste stand, sta een halve stap ervandaan. Ellebogen tegen je ribben.',
    execution: [
      'Buig in 1 tel omhoog, de kabel houdt ook onderin spanning.',
      'Laat in 3 tellen zakken tot bijna gestrekt.',
      'Blijf rechtop; de kabel trekt je licht naar voren.',
    ],
    mistake: 'Naar de kabel toe leunen, waardoor de weerstand halverwege wegvalt.',
  },
  kb_curl: {
    setup: 'Kettlebell aan de handvatbeugel, bel hangt onder je hand. Elleboog tegen je ribben.',
    execution: [
      'Buig in 1 tel omhoog, pols recht onder de bel.',
      'Laat in 3 tellen zakken.',
      'De bel kantelt; houd je onderarm daardoor extra strak.',
    ],
    mistake: 'De pols laten knikken door het gewicht dat achter je hand hangt.',
  },
  band_curl: {
    setup: 'Beide voeten op het midden van de band, uiteinden in je handen, handpalmen vooruit.',
    execution: [
      'Buig in 1 tel omhoog; de band wordt bovenin zwaarder.',
      'Laat in 3 tellen afgeremd zakken.',
      'Sta breder op de band voor meer weerstand.',
    ],
    mistake: 'De band laten terugtrekken zonder af te remmen.',
  },

  /* ---------------- pull_vertical ---------------- */
  lat_pulldown: {
    setup:
      'Beensteun strak op je bovenbenen. Greep iets breder dan schouderbreed, armen gestrekt, borst omhoog.',
    execution: [
      'Trek in 1 tel je schouderbladen omlaag en dan pas je ellebogen naar je ribben.',
      'Stang tot je sleutelbeen, niet lager.',
      'Laat in 3 tellen terugkomen tot je schouders volledig gestrekt zijn.',
    ],
    mistake: 'Ver achterover leunen en met het lichaamsgewicht trekken.',
  },
  lat_pulldown_neutral: {
    setup:
      'Neutrale greep, handen op schouderbreedte met de handpalmen naar elkaar. Beensteun strak, borst omhoog.',
    execution: [
      'Trek in 1 tel naar je bovenborst, ellebogen recht naar beneden.',
      'Knijp 1 tel je schouderbladen omlaag en naar elkaar.',
      'Laat in 3 tellen volledig strekken bovenin.',
    ],
    mistake: 'Alleen met de armen trekken zonder de schouderbladen te laten zakken.',
  },
  pullup: {
    setup: 'Greep iets breder dan schouderbreed, handpalmen vooruit. Hang volledig uit met actieve schouders.',
    execution: [
      'Trek in 1 tel tot je kin boven de stang is, borst naar de stang.',
      'Laat in 3 tellen zakken tot volledig gestrekt.',
      'Span je buik aan zodat je niet gaat zwaaien.',
    ],
    mistake: 'Met de benen schoppen om er extra reps uit te halen.',
  },
  chinup: {
    setup: 'Greep op schouderbreedte, handpalmen naar je toe. Hang volledig uit.',
    execution: [
      'Trek in 1 tel tot je kin boven de stang is, ellebogen langs je romp.',
      'Laat in 3 tellen zakken tot gestrekt.',
      'Ribben omlaag houden zodat je niet gaat hangen in je onderrug.',
    ],
    mistake: 'Halverwege stoppen met zakken, waardoor de rek en het onderste deel wegvallen.',
  },
  negative_pullup: {
    setup:
      'Stap of spring naar de bovenpositie met je kin boven de stang. Greep iets breder dan schouderbreed.',
    execution: [
      'Laat je in 5 tellen zo gelijkmatig mogelijk zakken.',
      'Rem het laatste stuk extra af — daar wordt het het zwaarst.',
      'Stap terug omhoog voor de volgende rep.',
    ],
    mistake: 'De eerste helft blokkeren en dan ineens vallen.',
  },
  straight_arm_pulldown: {
    setup:
      'Sta een stap van de toren, stang op borsthoogte, armen bijna gestrekt en zo houden. Romp licht voorover.',
    execution: [
      'Duw in 1 tel de stang naar je bovenbenen in een boog.',
      'Knijp 1 tel je lats aan onderin.',
      'Laat in 3 tellen terugkomen tot je rek voelt in je lats.',
    ],
    mistake: 'De ellebogen buigen, waardoor het een triceps pushdown wordt.',
  },
  band_pulldown: {
    setup: 'Band boven je bevestigd, uiteinden in je handen, armen gestrekt omhoog. Kniel of sta rechtop.',
    execution: [
      'Trek in 1 tel je ellebogen naar je ribben, schouderbladen eerst omlaag.',
      'Laat in 3 tellen afgeremd terugkomen tot volledig gestrekt.',
      'Kniel verder van het ankerpunt af voor meer weerstand.',
    ],
    mistake: 'De schouders laten optrekken naar de oren tijdens het trekken.',
  },

  /* ---------------- calf ---------------- */
  standing_calf_smith: {
    setup:
      'Voorvoeten op een verhoging, hakken vrij. Stang op je schouderbladen, knieën bijna gestrekt en zo houden.',
    execution: [
      'Zak in 3 tellen tot je maximale rek in je kuit.',
      'Kom in 1 tel omhoog tot volledig op je tenen en knijp 1 tel aan.',
      'Ga niet veren; elke rep begint stil vanuit de rek.',
    ],
    mistake: 'Door de knieën buigen om er hoogte bij te krijgen.',
  },
  seated_calf: {
    setup:
      'Zit met je voorvoeten op een verhoging, knieën in 90°, gewicht op je bovenbenen net boven de knie.',
    execution: [
      'Zak in 3 tellen tot volledige rek.',
      'Duw in 1 tel omhoog en knijp 2 tellen aan bovenin.',
      'Gebogen knie betekent dat je de soleus traint — houd het gewicht laag genoeg om de rek te halen.',
    ],
    mistake: 'Half werk maken van de rek onderin, waar de meeste winst zit.',
  },
  leg_press_calf: {
    setup:
      'Voorvoeten op de onderrand van het platform, hakken vrij. Benen bijna gestrekt, veiligheidspallen erop.',
    execution: [
      'Laat het platform in 3 tellen zakken tot maximale rek in je kuit.',
      'Duw in 1 tel weg tot volledige strekking en knijp 1 tel aan.',
      'Knieën blijven de hele set in dezelfde hoek.',
    ],
    mistake: 'De knieën mee laten buigen, waardoor het een halve leg press wordt.',
  },
  single_leg_calf_db: {
    setup:
      'Eén voorvoet op een verhoging, dumbbell in de hand aan dezelfde kant, andere hand steunt licht tegen de muur.',
    execution: [
      'Zak in 3 tellen tot maximale rek.',
      'Kom in 1 tel omhoog tot volledig op je tenen, 1 tel aanknijpen.',
      'De steunhand is voor balans, niet om mee te duwen.',
    ],
    mistake: 'Met de steunhand meedrukken, waardoor het been minder werk doet.',
  },
  heel_drop_ecc: {
    setup:
      'Voorvoeten op een tree of verhoging, hakken vrij. Kom met twee benen omhoog en zet je gewicht op één been.',
    execution: [
      'Laat in 4-5 tellen zakken op één been tot maximale rek.',
      'Kom met twee benen terug omhoog — de opweg telt niet mee.',
      'Doe een serie met gestrekte en een serie met licht gebogen knie.',
    ],
    mistake: 'Ook op één been omhoog komen, waardoor het geen excentrisch werk meer is.',
  },
  standing_calf_bw: {
    setup: 'Voorvoeten op een verhoging, hakken vrij, hand licht tegen de muur voor balans.',
    execution: [
      'Zak in 3 tellen tot maximale rek.',
      'Kom in 1 tel omhoog en knijp 1 tel aan.',
      'Maak het zwaarder door langzamer te zakken, niet door sneller te gaan.',
    ],
    mistake: 'Snelle halve reps maken zonder de rek onderin te pakken.',
  },
  seated_calf_bw: {
    setup: 'Zit met je voorvoeten op een verhoging, knieën in 90°, handen op je bovenbenen.',
    execution: [
      'Zak in 3 tellen tot volledige rek.',
      'Kom in 1 tel omhoog en knijp 2 tellen aan.',
      'Duw met je handen op je knieën als je meer weerstand wilt.',
    ],
    mistake: 'Te snel gaan; met licht gewicht is het tempo je enige belasting.',
  },
  tibialis_raise: {
    setup: 'Met je rug tegen de muur, hakken 20-30 cm van de muur, benen gestrekt.',
    execution: [
      'Trek in 1 tel je tenen zo ver mogelijk omhoog.',
      'Laat in 3 tellen zakken tot je voeten plat zijn.',
      'Zet je hakken verder van de muur om het zwaarder te maken.',
    ],
    mistake: 'De hielen mee laten komen in plaats van alleen de tenen te heffen.',
  },

  /* ---------------- abduction ---------------- */
  band_lateral_walk: {
    setup:
      'Band net boven de knieën of om je enkels. Zak in een halve squat, voeten heupbreed, tenen vooruit.',
    execution: [
      'Stap opzij met de voorste voet en volg gecontroleerd met de andere.',
      'Houd de band de hele set op spanning; je voeten komen nooit tegen elkaar.',
      'Blijf laag; kom niet omhoog tussen de stappen door.',
    ],
    mistake: 'De knieën naar binnen laten vallen als de band trekt.',
  },
  band_hip_abduction_seated: {
    setup: 'Zit op de bank, band net boven de knieën, voeten plat en heupbreed. Romp licht voorover.',
    execution: [
      'Duw in 1 tel je knieën naar buiten tot maximale spanning.',
      'Knijp 1 tel aan buitenin.',
      'Laat in 3 tellen terugkomen zonder de spanning te lossen.',
    ],
    mistake: 'De knieën laten terugklappen in plaats van afgeremd terug te brengen.',
  },
  cable_hip_abduction: {
    setup:
      'Enkelband aan de laagste kabelstand, sta zijwaarts, kabelbeen het verst van de toren. Hand aan het frame voor balans.',
    execution: [
      'Til in 1 tel je been zijwaarts, been gestrekt en teen vooruit.',
      'Knijp 1 tel aan bovenin.',
      'Laat in 3 tellen terugkomen, houd je romp rechtop.',
    ],
    mistake: 'Met de romp naar de andere kant hangen om het been hoger te krijgen.',
  },
  standing_band_abduction: {
    setup: 'Band om beide enkels, sta rechtop, hand licht tegen de muur voor balans.',
    execution: [
      'Til in 1 tel één been zijwaarts, teen vooruit.',
      'Laat in 3 tellen afgeremd terugkomen tot net voor je voeten elkaar raken.',
      'Standbeen blijft licht gebogen en stil.',
    ],
    mistake: 'Het been naar achteren zwaaien in plaats van recht opzij.',
  },
  clamshell: {
    setup:
      'Op je zij, heupen en knieën gebogen, band net boven de knieën. Voeten op één lijn met je romp.',
    execution: [
      'Draai in 1 tel je bovenste knie omhoog, voeten blijven tegen elkaar.',
      'Knijp 1 tel aan bovenin.',
      'Laat in 3 tellen zakken zonder je bekken te laten kantelen.',
    ],
    mistake: 'Het bekken naar achteren rollen om verder open te kunnen.',
  },
  monster_walk: {
    setup: 'Band om je enkels of net boven je knieën, halve squat, voeten heupbreed.',
    execution: [
      'Stap schuin naar voren en naar buiten, afwisselend links en rechts.',
      'Houd je voeten breder dan heupbreed zodat de band gespannen blijft.',
      'Blijf laag en met je borst omhoog.',
    ],
    mistake: 'Rechtop komen tijdens het lopen, waardoor de spanning wegvalt.',
  },
  side_lying_abduction: {
    setup: 'Op je zij, onderste been gebogen, bovenste been gestrekt in lijn met je romp.',
    execution: [
      'Til in 1 tel je bovenste been op tot ongeveer 45°, teen licht naar beneden gedraaid.',
      'Knijp 1 tel aan bovenin.',
      'Laat in 3 tellen zakken tot net boven je andere been.',
    ],
    mistake: 'Het been naar voren laten drijven, waardoor je heupbuiger het werk doet.',
  },
  side_plank_leg_lift: {
    setup:
      'Side plank op je onderarm, elleboog onder je schouder, lichaam in een rechte lijn van hoofd tot voeten.',
    execution: [
      'Houd de plank stabiel en til je bovenste been rustig op.',
      'Laat het in 3 tellen zakken zonder je heup te laten zakken.',
      'Reps zijn hier tellen: één beenhef per 2-3 seconden.',
    ],
    mistake: 'De onderste heup laten zakken zodra het been omhoog gaat.',
  },

  /* ---------------- core ---------------- */
  ab_roller_ex: {
    setup: 'Kniel met het wiel onder je schouders, armen gestrekt. Kantel je bekken naar achteren.',
    execution: [
      'Rol in 3 tellen naar voren tot net voordat je onderrug gaat hollen.',
      'Trek in 1-2 tellen terug met je buikspieren, niet met je armen.',
      'Ga alleen verder als je de bekkenkanteling kunt vasthouden.',
    ],
    mistake: 'Verder rollen dan je aankunt, waardoor de onderrug doorzakt.',
  },
  plank: {
    setup:
      'Onderarmen onder je schouders, voeten heupbreed. Bekken achterover gekanteld, ribben omlaag.',
    execution: [
      'Span je buik en bilspieren aan alsof je een stoot verwacht.',
      'Adem rustig door; reps zijn hier seconden.',
      'Stop de set zodra je heupen beginnen te zakken.',
    ],
    mistake: 'De tijd volmaken met een doorgezakte rug in plaats van korter en strak.',
  },
  dead_bug: {
    setup: 'Op je rug, armen recht omhoog, heupen en knieën in 90°. Onderrug plat tegen de grond.',
    execution: [
      'Strek in 2 tellen één arm en het tegenoverliggende been uit.',
      'Kom in 2 tellen terug, wissel van kant.',
      'Je onderrug blijft de hele set contact houden met de grond.',
    ],
    mistake: 'Zo ver uitstrekken dat de onderrug van de grond komt.',
  },
  side_plank: {
    setup: 'Op je zij, elleboog onder je schouder, voeten op elkaar of achter elkaar.',
    execution: [
      'Duw je heup omhoog tot een rechte lijn van hoofd tot voeten.',
      'Houd stil, adem door; reps zijn seconden.',
      'Onderste schouder actief omlaag houden, niet in de schouder hangen.',
    ],
    mistake: 'Naar voren of achteren kantelen in plaats van precies op je zij te blijven.',
  },
  hanging_knee_raise: {
    setup: 'Hang aan de stang met actieve schouders, benen gestrekt. Greep op schouderbreedte.',
    execution: [
      'Trek in 1 tel je knieën op tot boven heuphoogte en kantel je bekken mee.',
      'Laat in 3 tellen zakken tot volledig gestrekt.',
      'Zwaai niet: begin elke rep vanuit stilstand.',
    ],
    mistake: 'Alleen de heupbuigers gebruiken zonder het bekken te kantelen.',
  },
  cable_crunch: {
    setup:
      'Kniel voor de toren, touw naast je hoofd vastgehouden. Heupen in dezelfde hoek de hele set.',
    execution: [
      'Rol in 1 tel je romp naar beneden door je ribben naar je bekken te brengen.',
      'Knijp 1 tel aan onderin.',
      'Kom in 3 tellen omhoog tot je rek voelt in je buik.',
    ],
    mistake: 'Vanuit de heupen buigen in plaats van de wervelkolom te rollen.',
  },
  pallof_press: {
    setup:
      'Band of kabel op borsthoogte, sta zijwaarts, handen voor je borst. Stap opzij tot er spanning staat.',
    execution: [
      'Duw in 1 tel je handen recht vooruit; de band probeert je te draaien.',
      'Houd 2 tellen vast zonder mee te draaien.',
      'Kom in 2 tellen terug naar je borst.',
    ],
    mistake: 'Meedraaien met de romp, waardoor het een borstoefening wordt.',
  },

  /* ---------------- single_leg ---------------- */
  bulgarian_split_squat: {
    setup:
      'Achterste wreef op de bank, voorste voet twee stappen naar voren. Romp een paar graden voorover.',
    execution: [
      'Zak in 3 tellen recht naar beneden tot je achterste knie bijna de grond raakt.',
      'Duw in 1 tel omhoog via je voorste hiel.',
      'Zet je voorste voet verder naar voren als je knie voorbij je tenen schuift.',
    ],
    mistake: 'Te dicht bij de bank staan, waardoor de voorste knie ver over de tenen schiet.',
  },
  single_leg_press: {
    setup:
      'Eén voet midden op het platform, iets naar het midden toe. Ander been opzij, rug volledig tegen de leuning.',
    execution: [
      'Zak in 3 tellen tot je knie ongeveer 90° is.',
      'Duw in 1 tel terug via je hiel, knie in lijn met je voet.',
      'Stop net voor volledig gestrekt.',
    ],
    mistake: 'De knie naar binnen laten vallen tijdens het wegduwen.',
  },
  walking_lunge_db: {
    setup: 'Dumbbells naast je heupen, romp rechtop, voeten heupbreed.',
    execution: [
      'Stap naar voren en zak in 2 tellen tot je achterste knie bijna de grond raakt.',
      'Duw in 1 tel omhoog via je voorste hiel en stap direct door.',
      'Neem een grote stap: kleine stappen belasten alleen de knie.',
    ],
    mistake: 'Voorover vallen bij de landing in plaats van gecontroleerd te zakken.',
  },
  step_up_db: {
    setup:
      'Dumbbells naast je heupen, bank op knie- tot dijbeenhoogte. Hele voet op de bank, hiel erop.',
    execution: [
      'Duw in 1 tel via de hiel van je bovenste been omhoog tot volledig gestrekt.',
      'Laat in 3 tellen zakken en tik de grond licht aan.',
      'Duw niet af met het onderste been.',
    ],
    mistake: 'Met het onderste been meeschoppen om erop te komen.',
  },
  reverse_lunge_sandbag: {
    setup: 'Zak op je schouder of voor je borst geklemd. Voeten heupbreed, romp rechtop.',
    execution: [
      'Stap naar achteren en zak in 2 tellen tot je achterste knie bijna de grond raakt.',
      'Duw in 1 tel terug omhoog via je voorste hiel.',
      'Voorste scheen blijft ongeveer verticaal.',
    ],
    mistake: 'Naar achteren wegvallen; zet de achterste voet gecontroleerd neer.',
  },
  single_leg_rdl_db: {
    setup:
      'Dumbbell in de hand tegenover je standbeen. Standbeen licht gebogen, andere been achter je.',
    execution: [
      'Kantel in 3 tellen voorover, achterste been komt als tegenwicht omhoog in lijn met je romp.',
      'Stop bij de rek in je hamstring, heupen blijven horizontaal.',
      'Kom in 1 tel omhoog door je heup naar voren te duwen.',
    ],
    mistake: 'De heup van het vrije been laten openklappen naar buiten.',
  },
  split_squat_bw: {
    setup: 'Split stance, voorste voet twee stappen voor de achterste. Romp rechtop, handen op je heupen.',
    execution: [
      'Zak in 3 tellen recht naar beneden tot je achterste knie bijna de grond raakt.',
      'Duw in 1 tel omhoog via je voorste hiel.',
      'Beide voeten blijven op hun plek de hele set.',
    ],
    mistake: 'Naar voren stappen tijdens de set, waardoor de stand steeds korter wordt.',
  },
  step_up_bw: {
    setup: 'Bank op knie- tot dijbeenhoogte, hele voet erop met de hiel op de bank.',
    execution: [
      'Duw in 1 tel via je hiel omhoog tot volledig gestrekt.',
      'Laat in 3 tellen zakken en tik de grond licht aan.',
      'Zet de bank hoger om het zwaarder te maken.',
    ],
    mistake: 'Met het onderste been afzetten in plaats van met het bovenste been te duwen.',
  },
  single_leg_glute_bridge: {
    setup:
      'Op je rug, één voet plat met de hiel een handbreedte van je bil, het andere been opgetrokken of gestrekt.',
    execution: [
      'Duw in 1 tel je heupen omhoog tot een rechte lijn van knie tot schouder.',
      'Knijp 2 tellen je bilspier aan, heupen horizontaal.',
      'Zak in 3 tellen terug tot net boven de grond.',
    ],
    mistake: 'De heup van de vrije kant laten zakken, waardoor je scheef omhoog duwt.',
  },
}
