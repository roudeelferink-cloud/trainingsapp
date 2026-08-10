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
  progression: ProgressionType
  minIncrement: number
  loads: LoadArea[]
  setsReps: SetsReps
  bodyweightAlternative: string
  /** per been / per arm uitgevoerd */
  perSide?: boolean
  /** verfijning binnen pattern voor alternatieven */
  group?: MuscleGroup
  /** hoe de belasting wordt ingevoerd */
  unit?: 'kg' | 'band' | 'bw'
  cue?: string
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

export interface MaintenanceItem {
  id: string
  label: string
}

/** Stangen met een eigen gewicht. De schijven komen daar bovenop. */
export type BarId = 'smith' | 'trap_bar' | 'barbell' | 'deadlift_bar' | 'curl_bar'

export interface Settings {
  bodyweightKg: number | null
  sensitive: Record<LoadArea, Sensitivity>
  travelMode: boolean
  maintenanceItems: MaintenanceItem[]
  proteinFactor: number
  /** eigen gewicht per stang in kg; per sportschool anders, dus instelbaar */
  barWeights: Record<BarId, number>
}

export interface LoggedSet {
  weight: number
  reps: number
  rir: number
  /** afgevinkt; voorgevulde waarden tellen pas als gelogd zodra dit waar is */
  done?: boolean
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
}

export type SkipReason = 'druk' | 'etentje' | 'geen_zin' | 'ziek'

export interface RunLog {
  date: string
  kind: RunKind
  plannedKm: number
  km: number
  minutes: number | null
  bike: boolean
  completedAt: string | null
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
  intensity: ActivityIntensity
  /** vrije notitie; leeg veld wordt null */
  note: string | null
  createdAt: string
}

export interface ExerciseState {
  targetWeight: number | null
  targetReps: number | null
  belowMinStreak: number
  lastNote: string | null
  lastUpdated: string | null
}

export interface DayOverride {
  short?: boolean
  /** slotKey -> exerciseId, alleen voor vandaag */
  swaps?: Record<string, string>
  skippedSlots?: string[]
  /** loop vervangen door 30 min fietsen */
  bike?: boolean
  /** loopafstand handmatig of automatisch geschaald */
  runScale?: number
}

/**
 * Alles van één gebruiker. Dit is wat de logica leest: progressie, streefgewichten
 * en voortgang worden altijd over precies één `UserState` berekend, nooit over twee.
 * In Firestore is dit één document onder `trainingsapp/{code}/gebruikers/{id}`.
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
  /** datum -> gram eiwit */
  protein: Record<string, number>
  /** datum -> afgevinkte onderhoudsitems */
  maintenance: Record<string, string[]>
  /** sessiesleutel -> log */
  sessions: Record<string, SessionLog>
  /** datum -> looplog */
  runs: Record<string, RunLog>
  /** losse, ongeplande activiteiten naast het schema */
  activities: Activity[]
  /** datum -> reden (overgeslagen krachtsessie of loop) */
  skips: Record<string, { reason: SkipReason; what: 'strength' | 'run' }>
  /** originele datum -> nieuwe datum (alleen krachtsessies) */
  moves: Record<string, string>
  /** datum -> tijdelijke aanpassingen */
  overrides: Record<string, DayOverride>
  exerciseState: Record<string, ExerciseState>
  notices: { date: string; text: string }[]
  /** ISO-tijdstip van de laatste export; null = nog nooit geëxporteerd */
  lastExportAt: string | null
  /** ISO-tijdstip van de laatste lokale wijziging; bepaalt wie wint bij sync */
  updatedAt: string | null
}

/**
 * De volledige opgeslagen staat: welk huishouden, wie je bent, en de gebruikers.
 * Alleen de store en de synclaag werken hierop. Schermen en logica krijgen de
 * `UserState` van de geselecteerde gebruiker, zodat data van de ander per
 * constructie niet in een berekening kan meelopen.
 */
export interface AppState {
  schemaVersion: number
  /** gedeelde huishoudcode (16 hex); leeg = nog niet ingesteld */
  household: string
  /** id van de gebruiker die dit toestel gebruikt; leeg = nog niet gekozen */
  currentUser: string
  /** gebruikersid -> gebruiker */
  users: Record<string, UserState>
}
