export type Pattern =
  | 'knee_dominant'
  | 'hip_dominant'
  | 'push_horizontal'
  | 'push_vertical'
  | 'pull_horizontal'
  | 'pull_vertical'
  | 'calf'
  | 'abduction'
  | 'core'
  | 'single_leg'

export type Equipment =
  | 'smith'
  | 'barbell'
  | 'plates'
  | 'pullup_bar'
  | 'bench'
  | 'lat_tower'
  | 'low_cable'
  | 'leg_press'
  | 'leg_ext_curl'
  | 'trap_bar'
  | 'deadlift_bar'
  | 'curl_bar'
  | 'dumbbells'
  | 'kettlebell'
  | 'sandbag'
  | 'band'
  /** set mini-loopbands met oplopende weerstand; niveau in plaats van kilo's */
  | 'mini_band'
  /** enkelmanchet voor de lage kabel */
  | 'ankle_strap'
  | 'ab_roller'
  | 'bike'
  | 'bodyweight'

export type LoadArea =
  | 'knee_deep'
  | 'hip_deep'
  | 'achilles'
  | 'calf'
  | 'lateral_hip'
  | 'lower_back'
  | 'shoulder'

export type Role = 'core' | 'accessory'
export type ProgressionType = 'weight' | 'reps'

/**
 * Plek in de vaste volgorde van een krachtsessie. Zwaar en technisch werk staat
 * vooraan, licht en vermoeiend werk achteraan. Dit staat bewust op de oefening
 * zelf en niet in een lijstje in de UI: een nieuwe oefening loopt zo vanzelf mee
 * in de sortering, zonder dat er ergens anders iets bijgewerkt hoeft te worden.
 *
 * 1. `heavy_legs`  zwaarste samengestelde beenoefening (squat, leg press, RDL)
 * 2. `compound`    overige samengestelde oefening (bank, roeien, pulldown, press)
 * 3. `isolation`   isolatie (leg extension, leg curl, biceps, kuiten)
 * 4. `core`        romp; die sluit de sessie af
 */
export type OrderCategory = 'heavy_legs' | 'compound' | 'isolation' | 'core'

/** Fijnere groepering binnen een pattern, zodat "wissel" geen onzin voorstelt. */
export type MuscleGroup = 'triceps' | 'biceps' | 'delts' | 'abs' | 'quad' | 'ham'

export interface SetsReps {
  sets: number
  repMin: number
  repMax: number
}

/** Korte uitleg bij een oefening. Alles in het Nederlands, concreet. */
export interface Coaching {
  /** 1-2 zinnen: stand, greep, instelling van de machine */
  setup: string
  /** 2-3 korte punten: de beweging zelf, inclusief tempo */
  execution: string[]
  /** 1 zin: de meest gemaakte fout */
  mistake: string
  /** optionele korte opmerking over het apparaat, bijvoorbeeld bij een combimachine */
  note?: string
}

/**
 * Verhouding tot de oefening met de meest vergelijkbare belastingsvorm: hetzelfde
 * apparaat, of anders dezelfde soort weerstand. Mag over bewegingspatronen heen.
 */
export interface RelatedRatio {
  exerciseId: string
  ratio: number
}

export interface Exercise {
  id: string
  naam: string
  pattern: Pattern
  equipment: Equipment[]
  role: Role
  /** plek in de vaste volgorde binnen een sessie */
  orderCategory: OrderCategory
  progression: ProgressionType
  minIncrement: number
  loads: LoadArea[]
  setsReps: SetsReps
  bodyweightAlternative: string
  /**
   * Eenarmig of eenbenig: je doet de oefening per kant, dus een set is twee keer werk
   * en de herhalingen tellen per zijde. Bewust verplicht en expliciet per oefening —
   * een ontbrekende vlag zou stilzwijgend "tweezijdig" betekenen, en dat is precies de
   * aanname die de reps van eenarmig werk halveerde.
   */
  unilateral: boolean
  /** verfijning binnen pattern voor alternatieven */
  group?: MuscleGroup
  /** hoe de belasting wordt ingevoerd */
  unit?: 'kg' | 'band' | 'bw'
  cue?: string
  /**
   * Waar deze oefening naartoe groeit zodra hij op is. Bedoeld voor bandwerk: een
   * band gaat maar tot het zwaarste niveau, daarna is er echte gewichtsprogressie
   * nodig. De selectie schakelt vanzelf door zodra het bovenste bandniveau gehaald is.
   */
  progressesTo?: string
  /** uitleg: opzet, uitvoering en de meest gemaakte fout */
  coaching: Coaching
  /** heeft deze oefening een poppetje? alleen samengestelde oefeningen */
  hasFigure: boolean
  /** vermenigvuldiger van het lichaamsgewicht voor een conservatief startpunt */
  startFactor: number
  /** verhouding tot de best vergelijkbare oefening, gebruikt zodra daar data van is */
  relatedRatio?: RelatedRatio
}

export type DayKind =
  | 'legs_a'
  | 'push'
  | 'pull'
  | 'legs_b'
  | 'optional_upper'
  | 'full_body_a'
  | 'full_body_b'
  | 'rest'
export type RunKind = 'short' | 'long'

/** Welk trainingsprogramma een gebruiker volgt. Bepaalt week, sjablonen en tempo. */
export type ProgramId = 'kracht_hardlopen' | 'fullbody_hardlopen'

export interface SessionSlot {
  key: string
  exerciseId: string
  role: Role
  setsReps: SetsReps
}

export interface SessionTemplate {
  id: DayKind
  naam: string
  duurMin: number
  optional?: boolean
  slots: SessionSlot[]
}

/* ---------- opgeslagen staat ---------- */

export type Sensitivity = 'ok' | 'careful' | 'off'

/** Stangen met een eigen gewicht. De schijven komen daar bovenop. */
export type BarId = 'smith' | 'trap_bar' | 'barbell' | 'deadlift_bar' | 'curl_bar'

export interface Settings {
  bodyweightKg: number | null
  sensitive: Record<LoadArea, Sensitivity>
  travelMode: boolean
  /** eigen gewicht per stang in kg; per sportschool anders, dus instelbaar */
  barWeights: Record<BarId, number>
  /**
   * De schijven die er liggen, in kg per schijf, oplopend. Schijven gaan altijd per
   * paar op de stang, dus de kleinste echte stap is twee keer de lichtste schijf.
   * De progressie rondt hiernaartoe af: een voorstel dat niet te laden is, is geen
   * voorstel.
   */
  plates: number[]
}

/** Waarmee je warm wordt: rustig op de loopband of losfietsen op de spinningfiets. */
export type WarmupType = 'loopband' | 'fiets'

/**
 * Het warming-upblok waar elke krachtsessie mee begint. Type en duur zijn per
 * sessie in te stellen en het blok is af te vinken, net als een oefening.
 */
export interface Warmup {
  type: WarmupType
  minutes: number
  done: boolean
}

export interface LoggedSet {
  weight: number
  reps: number
  rir: number
  /**
   * Bandniveau bij een oefening met `unit: 'band'`: 1 is de lichtste band. Bandwerk
   * heeft geen kilo's, dus daar blijft `weight` 0 en telt dit veld. Zo blijven het
   * tilvolume en het geschatte 1RM schoon.
   */
  level?: number
  /** afgevinkt; voorgevulde waarden tellen pas als gelogd zodra dit waar is */
  done?: boolean
}

/**
 * Hoe een sessie viel. Eén tik na afloop, bij kracht én bij hardlopen.
 *
 * Dit is de enige subjectieve maat die de guardrails gebruiken: 'makkelijk' en 'goed'
 * geven ruimte om te verhogen, 'zwaar' zet alles op de rem. Ontbreekt hij (oude logs,
 * of overgeslagen), dan valt de progressie terug op de gelogde RIR.
 */
export type Feel = 'makkelijk' | 'goed' | 'zwaar'

/** Schaal van 3 voor de dagcheck: 1 = slecht, 2 = oké, 3 = goed. */
export type DayScore = 1 | 2 | 3

/**
 * Optionele dagcheck: hoe je geslapen hebt en hoeveel energie je hebt. Overslaan mag
 * en heeft geen gevolgen; ingevuld telt hij mee in de deloadbeslissing.
 */
export interface DayCheck {
  sleep: DayScore
  energy: DayScore
}

export interface SessionLog {
  /** sessiesleutel: `${datum}:${dayKind}` */
  date: string
  kind: DayKind
  completedAt: string | null
  short: boolean
  entries: Record<string, LoggedSet[]> // slotKey -> sets
  /** slotKey -> exerciseId zoals daadwerkelijk uitgevoerd */
  exercises: Record<string, string>
  skippedSlots: string[]
  /** slotKeys van oefeningen die als afgerond gemarkeerd zijn */
  completedSlots: string[]
  /** warming-up van deze sessie; ontbreekt bij logs van vóór dit blok bestond */
  warmup?: Warmup
  /** afsluitende beoordeling; ontbreekt bij oude logs en bij overslaan */
  feel?: Feel
  /**
   * Wanneer je aan deze sessie begon. Samen met `completedAt` is dit hoe lang hij echt
   * duurde — de enige manier om te weten of een sessie binnen de geplande tijd bleef.
   * Ontbreekt bij logs van vóór dit veld bestond; dan doet de app er geen uitspraak over.
   */
  startedAt?: string
  /**
   * De oefening die er na afloop bij is gekomen omdat de sessie te makkelijk viel.
   * Staat er hooguit één; zolang dit veld gevuld is krijgt de volgende sessie geen
   * aanbod, zodat er niet elke keer iets bij komt.
   */
  extra?: string
}

export type SkipReason = 'druk' | 'etentje' | 'geen_zin' | 'ziek'

/**
 * Eén hardloopsessie. Gepland en werkelijk staan bewust apart: `plannedKm` is wat de
 * app voorschreef op het moment van afvinken, `km` is wat er echt gelopen is. Het
 * verschil tussen die twee is precies wat het loopvolume verderop bijstuurt.
 */
export interface RunLog {
  date: string
  kind: RunKind
  plannedKm: number
  km: number
  minutes: number | null
  bike: boolean
  completedAt: string | null
  /** afsluitende beoordeling; ontbreekt bij oude logs en bij overslaan */
  feel?: Feel
}

/* ---------- losse activiteiten ---------- */

export type ActivityType = 'fietsen' | 'wandelen' | 'zwemmen' | 'hardlopen' | 'spinning' | 'overig'
export type ActivityIntensity = 'rustig' | 'normaal' | 'intensief'

/**
 * Iets wat je naast het schema gedaan hebt: een avondrondje op de fiets, een
 * wandeling, een keer zwemmen. Staat volledig los van de krachtprogressie en het
 * loopvolume: deze logs sturen geen gewichtsadvies en veranderen het schema niet.
 */
export interface Activity {
  id: string
  date: string
  type: ActivityType
  minutes: number
  /** afstand in km bij een afstandsactiviteit; null als hij niet van toepassing is */
  distanceKm: number | null
  intensity: ActivityIntensity
  /** vrije notitie; leeg veld wordt null */
  note: string | null
  createdAt: string
}

export interface ExerciseState {
  targetWeight: number | null
  targetReps: number | null
  /** streefniveau bij bandwerk; null of afwezig bij alles wat in kilo's gaat */
  targetLevel?: number | null
  /**
   * Id van de oefening waar deze in opgegaan is: het bandwerk is op het zwaarste
   * niveau uitgegroeid en gaat verder als de belaste variant. De selectie pakt die
   * vanaf dan vanzelf, zolang hij niet wegvalt door reismodus of een gevoelig gebied.
   */
  graduatedTo?: string | null
  belowMinStreak: number
  lastNote: string | null
  lastUpdated: string | null
  /**
   * Maandag van de week waarin het streefgewicht voor het laatst omhoog ging, plus
   * hoeveel kilo er die week al bij kwam. Samen bewaken ze de maximale sprong per
   * oefening per week: meerdere goede sessies in één week leveren niet meer op dan één.
   */
  increaseWeek?: string | null
  increasedKg?: number
}

/** Waarom een voorstel afweek van wat de gebruiker uiteindelijk deed. */
export type DeviationKind = 'run_plan' | 'run_distance' | 'lift_weight' | 'deload_skip'

/**
 * Een afwijking van een voorstel. De app stuurt bij, maar houdt niemand tegen: wat de
 * gebruiker anders doet wordt vastgelegd zodat er later een patroon uit te lezen is
 * ("elke zondag 2 km verder dan gepland").
 */
export interface Deviation {
  id: string
  date: string
  kind: DeviationKind
  /** waar het voorstel op uitkwam; null als het geen getal is */
  suggested: number | null
  /** wat de gebruiker koos */
  chosen: number | null
  /** één regel uitleg, in gewone taal */
  note: string
  createdAt: string
}

/**
 * Een bewust overgeslagen deloadweek. Kan alleen ontstaan na een expliciete
 * bevestiging waarin het risico benoemd staat; de sleutel is de maandag van die week.
 */
export interface DeloadSkip {
  weekStart: string
  confirmedAt: string
  /** de tekst die de gebruiker bevestigd heeft, zodat achteraf duidelijk is wat er stond */
  acknowledged: string
}

export interface DayOverride {
  short?: boolean
  /** slotKey -> exerciseId, alleen voor vandaag */
  swaps?: Record<string, string>
  skippedSlots?: string[]
  /**
   * Eigen volgorde van de oefeningen: slotKeys in de volgorde die jij wilt. De
   * automatische sortering is de standaard, geen slot — staat dit veld er, dan
   * wint het. Slots die er niet in staan volgen erachter in de standaardvolgorde.
   */
  order?: string[]
  /** loop vervangen door 30 min fietsen */
  bike?: boolean
  /** loopafstand handmatig of automatisch geschaald */
  runScale?: number
  /**
   * De oefening die na afloop aan deze sessie is toegevoegd. Staat in de override en
   * niet in het sjabloon: het is een keuze voor deze ene dag, en morgen begint de sessie
   * weer zoals hij bedoeld is.
   */
  extraSlot?: { key: string; exerciseId: string }
}

/**
 * Alles van één gebruiker. Dit is wat de logica leest: progressie, streefgewichten
 * en voortgang worden altijd over precies één `UserState` berekend, nooit over twee.
 * Alles staat lokaal op dit toestel; verplaatsen naar een ander toestel gaat via
 * export en import.
 */
export interface UserState {
  /** stabiel id; blijft gelijk als de naam verandert */
  id: string
  naam: string
  programId: ProgramId
  startDate: string // maandag van week 1
  settings: Settings
  /** slotKey -> exerciseId (permanent, rouleert niet mee) */
  permanentReplacements: Record<string, string>
  /** datum -> 1..5 */
  checkins: Record<string, number>
  /** datum -> optionele dagcheck (slaap en energie) */
  dayChecks: Record<string, DayCheck>
  /** sessiesleutel -> log */
  sessions: Record<string, SessionLog>
  /** datum -> looplog */
  runs: Record<string, RunLog>
  /**
   * datum -> handmatig gezette geplande afstand in km. Wint van wat de app uitrekent,
   * ook van de +10%-bewaking: het voorstel is een voorstel.
   */
  runPlans: Record<string, number>
  /** maandag -> bewust overgeslagen deloadweek */
  deloadSkips: Record<string, DeloadSkip>
  /**
   * Weggeklikte structurele meldingen: patroonsleutel -> datum waarop dat gebeurde.
   * De sleutel ís het patroon, dus zodra de combinatie verandert komt de melding vanzelf
   * terug; verandert er niets, dan blijft hij vier weken stil.
   */
  dismissedWarnings: Record<string, string>
  /** afwijkingen van voorstellen, oudste eerst */
  deviations: Deviation[]
  /** losse, ongeplande activiteiten naast het schema */
  activities: Activity[]
  /** datum -> reden (overgeslagen krachtsessie of loop) */
  skips: Record<string, { reason: SkipReason; what: 'strength' | 'run' }>
  /** originele datum -> nieuwe datum, krachtsessies */
  moves: Record<string, string>
  /** originele datum -> nieuwe datum, loopsessies; los van `moves` zodat een dag
   * met loop én kracht ze onafhankelijk kan verplaatsen */
  runMoves: Record<string, string>
  /** datum -> tijdelijke aanpassingen */
  overrides: Record<string, DayOverride>
  exerciseState: Record<string, ExerciseState>
  notices: { date: string; text: string }[]
  /** ISO-tijdstip van de laatste export; null = nog nooit geëxporteerd */
  lastExportAt: string | null
}

/**
 * De volledige opgeslagen staat: wie dit toestel gebruikt en de gebruikers zelf.
 * Alleen de store werkt hierop. Schermen en logica krijgen de `UserState` van de
 * geselecteerde gebruiker, zodat data van de ander per constructie niet in een
 * berekening kan meelopen.
 *
 * Deze staat is lokaal: elk toestel houdt zijn eigen gebruikers en historie bij.
 */
export interface AppState {
  schemaVersion: number
  /** id van de gebruiker die dit toestel gebruikt; leeg = nog niet gekozen */
  currentUser: string
  /**
   * Pincode van 4 cijfers voor het wissen van gegevens; null = nog niet ingesteld.
   *
   * Dit is misklikbeveiliging, geen echte beveiliging: de code staat als platte tekst
   * in localStorage en is met de ontwikkelaarsconsole zo te lezen. Hij is er om te
   * voorkomen dat "alles wissen" per ongeluk in twee tikken gebeurt, niet om data
   * tegen iemand anders te beschermen.
   */
  pin: string | null
  /** gebruikersid -> gebruiker */
  users: Record<string, UserState>
}
