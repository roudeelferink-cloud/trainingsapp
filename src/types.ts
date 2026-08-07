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
}

export type DayKind = 'legs_a' | 'push' | 'pull' | 'legs_b' | 'optional_upper' | 'rest'
export type RunKind = 'short' | 'long'

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

export interface Settings {
  bodyweightKg: number | null
  sensitive: Record<LoadArea, Sensitivity>
  travelMode: boolean
  maintenanceItems: MaintenanceItem[]
  proteinFactor: number
}

export interface LoggedSet {
  weight: number
  reps: number
  rir: number
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

export interface AppState {
  schemaVersion: number
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
}
