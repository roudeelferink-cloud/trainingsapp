import { useSyncExternalStore } from 'react'
import type { AppState, ProgramId, UserState } from '../types'
import { mondayOf, today } from '../logic/dates'
import { ANOUC, ROB, defaultSettingsFor, normalizeSettings } from './settings'
import { runMigrations, type RawState } from './migrations'

export const SCHEMA_VERSION = 9
/** Het achtervoegsel is historisch; versiebeheer loopt via schemaVersion en migrations.ts. */
const KEY = 'trainingsapp.state.v1'

/** Vaste gebruikers van dit huishouden. Ids zijn stabiel; namen mogen wijzigen. */
export { ANOUC, ROB }

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
    protein: {},
    maintenance: {},
    sessions: {},
    runs: {},
    activities: [],
    skips: {},
    moves: {},
    runMoves: {},
    overrides: {},
    exerciseState: {},
    notices: [],
    lastExportAt: null,
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
    protein: s.protein ?? {},
    maintenance: s.maintenance ?? {},
    sessions: s.sessions ?? {},
    runs: s.runs ?? {},
    activities: Array.isArray(s.activities) ? s.activities : [],
    skips: s.skips ?? {},
    moves: s.moves ?? {},
    runMoves: s.runMoves ?? {},
    overrides: s.overrides ?? {},
    exerciseState: s.exerciseState ?? {},
    notices: Array.isArray(s.notices) ? s.notices : [],
    lastExportAt: typeof s.lastExportAt === 'string' ? s.lastExportAt : null,
  }
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

  return { schemaVersion: SCHEMA_VERSION, currentUser, users }
}

/* ---------------- opslag ---------------- */

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultRoot()
    return migrate(JSON.parse(raw))
  } catch {
    return defaultRoot()
  }
}

let root: AppState = load()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(root))
  } catch {
    /* quota vol of private mode: app blijft werken in geheugen */
  }
}

export function getRoot(): AppState {
  return root
}

/** Id van de gebruiker die dit toestel gebruikt; valt terug op de eerste. */
export function currentUserId(): string {
  return root.users[root.currentUser] ? root.currentUser : USER_SEEDS[0].id
}

/**
 * De staat van de geselecteerde gebruiker. Alle logica en alle schermen werken
 * hierop, dus wat je ziet en wat de app berekent volgt altijd één gebruiker.
 */
export function getState(): UserState {
  return root.users[currentUserId()]
}

export function getUser(id: string): UserState | null {
  return root.users[id] ?? null
}

/**
 * Muteert uitsluitend de geselecteerde gebruiker. Er is bewust geen actie die een
 * andere gebruiker schrijft: loggen kan alleen voor jezelf.
 */
export function setState(updater: (s: UserState) => UserState): void {
  const id = currentUserId()
  root = { ...root, users: { ...root.users, [id]: { ...updater(root.users[id]), id } } }
  persist()
  emit()
}

export function replaceRoot(next: AppState): void {
  root = next
  persist()
  emit()
}

/** Bestaande tests en code die de hele staat vervangen: gaat naar de huidige gebruiker. */
export function replaceState(next: UserState): void {
  const id = currentUserId()
  root = { ...root, users: { ...root.users, [id]: { ...next, id } } }
  persist()
  emit()
}

export function resetState(): void {
  replaceRoot(defaultRoot())
}

export function setCurrentUser(id: string): void {
  if (!root.users[id]) return
  replaceRoot({ ...root, currentUser: id })
}

export function setUserName(id: string, naam: string): void {
  const clean = naam.trim()
  if (!root.users[id] || !clean) return
  root = { ...root, users: { ...root.users, [id]: { ...root.users[id], naam: clean } } }
  persist()
  emit()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** De geselecteerde gebruiker, reactief. */
export function useStore(): UserState {
  return useSyncExternalStore(subscribe, getState, getState)
}

/** De volledige staat (wie je bent en beide gebruikers), reactief. */
export function useRoot(): AppState {
  return useSyncExternalStore(subscribe, getRoot, getRoot)
}

/* ---------------- export / import ---------------- */

/** Bouwt de export en onthoudt wanneer er voor het laatst geëxporteerd is. */
export function exportJSON(): string {
  const stamp = new Date().toISOString()
  const id = currentUserId()
  const users = Object.fromEntries(
    Object.entries(root.users).map(([k, u]) => [k, k === id ? { ...u, lastExportAt: stamp } : u]),
  )
  const payload = JSON.stringify({ ...root, users, exportedAt: stamp }, null, 2)
  setState((s) => ({ ...s, lastExportAt: stamp }))
  return payload
}

export function importJSON(text: string): { ok: true } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Geen geldige JSON.' }
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Bestand bevat geen object.' }
  const v = (parsed as { schemaVersion?: unknown }).schemaVersion
  if (typeof v !== 'number') return { ok: false, error: 'schemaVersion ontbreekt.' }
  if (v > SCHEMA_VERSION) {
    return { ok: false, error: `Bestand komt uit een nieuwere versie (${v}). Werk de app eerst bij.` }
  }
  // ouder bestand: migrate() hoogt het op naar de huidige versie
  const next = migrate(parsed)
  // een bestand zonder gekozen gebruiker mag de keuze van dit toestel niet wissen
  replaceRoot({ ...next, currentUser: next.currentUser || root.currentUser })
  return { ok: true }
}
