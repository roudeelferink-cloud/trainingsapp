import type { AppState, ProgramId, ReviewCache, UserState } from '../types'
import { mondayOf, today } from '../logic/dates'
import { ANOUC, ROB, defaultSettingsFor, normalizeSettings } from './settings'
import { runMigrations, type RawState } from './migrations'

/**
 * Het schema: hoe een lege staat eruitziet, en hoe oude data naar de huidige versie
 * getild wordt.
 *
 * Dit staat los van `store.ts` omdat het losstaat: hier zit geen React in, geen
 * localStorage en geen abonnement — alleen data in, data uit. Daardoor kan het servertje
 * in `server/` dezelfde migratie draaien op de staat die de app opstuurt, zonder dat er
 * een browser-store aan hangt. Eén migratiepad voor de app en voor de server; twee
 * versies daarvan zouden vroeg of laat uit elkaar lopen.
 */

/** Vaste gebruikers van dit huishouden. Ids zijn stabiel; namen mogen wijzigen. */
export { ANOUC, ROB }

/**
 * Pincode voor "alles wissen". Zie `AppState.pin`: misklikbeveiliging, geen echte
 * beveiliging — hij staat leesbaar in localStorage.
 */
export function isPin(code: unknown): code is string {
  return typeof code === 'string' && /^[0-9]{4}$/.test(code)
}

export const SCHEMA_VERSION = 15

export const USER_SEEDS: { id: string; naam: string; programId: ProgramId }[] = [
  { id: ROB, naam: 'Rob', programId: 'kracht_hardlopen' },
  { id: ANOUC, naam: 'Anouc', programId: 'fullbody_hardlopen' },
]

export function defaultUser(id: string, naam: string, programId: ProgramId): UserState {
  return {
    id,
    naam,
    programId,
    startDate: mondayOf(today()),
    settings: defaultSettingsFor(id),
    permanentReplacements: {},
    checkins: {},
    dayChecks: {},
    sessions: {},
    runs: {},
    runPlans: {},
    deloadSkips: {},
    dismissedWarnings: {},
    deviations: [],
    activities: [],
    skips: {},
    moves: {},
    runMoves: {},
    overrides: {},
    exerciseState: {},
    notices: [],
    lastExportAt: null,
    review: null,
  }
}

/** Lege gebruiker; de losse velden zijn identiek aan wat de logica verwacht. */
export function defaultState(): UserState {
  return defaultUser(ROB, 'Rob', 'kracht_hardlopen')
}

export function defaultRoot(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    currentUser: '',
    pin: null,
    users: Object.fromEntries(
      USER_SEEDS.map((u) => [u.id, defaultUser(u.id, u.naam, u.programId)]),
    ),
  }
}

/* ---------------- migratie ---------------- */

function migrateUser(raw: unknown, id: string, naam: string, programId: ProgramId): UserState {
  const base = defaultUser(id, naam, programId)
  if (!raw || typeof raw !== 'object') return base
  const s = raw as Partial<UserState>
  // de startinstellingen van deze gebruiker als terugval, daarna repareren wat er niet klopt
  const settings = normalizeSettings(s.settings, base.settings)
  return {
    ...base,
    ...s,
    id,
    naam: typeof s.naam === 'string' && s.naam.trim() ? s.naam : naam,
    programId: s.programId === 'fullbody_hardlopen' || s.programId === 'kracht_hardlopen'
      ? s.programId
      : programId,
    startDate: typeof s.startDate === 'string' ? s.startDate : base.startDate,
    settings,
    permanentReplacements: s.permanentReplacements ?? {},
    checkins: s.checkins ?? {},
    dayChecks: s.dayChecks ?? {},
    sessions: s.sessions ?? {},
    runs: s.runs ?? {},
    runPlans: s.runPlans ?? {},
    deloadSkips: s.deloadSkips ?? {},
    dismissedWarnings: s.dismissedWarnings ?? {},
    deviations: Array.isArray(s.deviations) ? s.deviations : [],
    activities: Array.isArray(s.activities) ? s.activities : [],
    skips: s.skips ?? {},
    moves: s.moves ?? {},
    runMoves: s.runMoves ?? {},
    overrides: s.overrides ?? {},
    exerciseState: s.exerciseState ?? {},
    notices: Array.isArray(s.notices) ? s.notices : [],
    lastExportAt: typeof s.lastExportAt === 'string' ? s.lastExportAt : null,
    review: isReviewCache(s.review) ? s.review : null,
  }
}

/**
 * Een bruikbaar opgeslagen advies. Half advies is geen advies: mist er een veld, dan
 * gaat het hele blok weg en haalt de app bij de volgende opening een nieuw op.
 */
function isReviewCache(v: unknown): v is ReviewCache {
  if (!v || typeof v !== 'object') return false
  const c = v as Partial<ReviewCache>
  if (typeof c.datum !== 'string' || typeof c.gegenereerdOp !== 'string') return false
  const r = c.review
  if (!r || typeof r !== 'object') return false
  return (
    Array.isArray(r.signalen) &&
    r.signalen.every((x) => typeof x === 'string') &&
    Array.isArray(r.advies) &&
    r.advies.every((x) => typeof x === 'string') &&
    typeof r.toon === 'string'
  )
}

/**
 * Tilt opgeslagen data naar de huidige schemaVersion en vult ontbrekende velden aan.
 * Oude data wordt opgehoogd, niet geweigerd of gewist. Crasht nooit op half-lege data.
 */
export function migrate(raw: unknown): AppState {
  const base = defaultRoot()
  if (!raw || typeof raw !== 'object') return base

  const incoming = raw as RawState
  const from = typeof incoming.schemaVersion === 'number' ? incoming.schemaVersion : 1
  const migrated = from < SCHEMA_VERSION ? runMigrations(incoming, from, SCHEMA_VERSION) : incoming
  const s = migrated as Partial<AppState>

  const rawUsers = (s.users && typeof s.users === 'object' ? s.users : {}) as Record<string, unknown>
  const users: Record<string, UserState> = {}
  for (const seed of USER_SEEDS) {
    users[seed.id] = migrateUser(rawUsers[seed.id], seed.id, seed.naam, seed.programId)
  }

  const currentUser = typeof s.currentUser === 'string' && users[s.currentUser] ? s.currentUser : ''
  const pin = isPin(s.pin) ? s.pin : null

  return { schemaVersion: SCHEMA_VERSION, currentUser, pin, users }
}
