import { useSyncExternalStore } from 'react'
import type { AppState, LoadArea, Sensitivity } from '../types'
import { mondayOf, today } from '../logic/dates'
import { runMigrations, type RawState } from './migrations'

export const SCHEMA_VERSION = 2
/** Het achtervoegsel is historisch; versiebeheer loopt via schemaVersion en migrations.ts. */
const KEY = 'trainingsapp.state.v1'

const ALL_AREAS: LoadArea[] = [
  'knee_deep',
  'hip_deep',
  'achilles',
  'calf',
  'lateral_hip',
  'lower_back',
  'shoulder',
]

export function defaultState(): AppState {
  const sensitive = Object.fromEntries(
    ALL_AREAS.map((a) => [a, a === 'lateral_hip' ? 'careful' : 'ok']),
  ) as Record<LoadArea, Sensitivity>

  return {
    schemaVersion: SCHEMA_VERSION,
    startDate: mondayOf(today()),
    settings: {
      bodyweightKg: null,
      sensitive,
      travelMode: false,
      proteinFactor: 1.8,
      maintenanceItems: [
        { id: 'heeldrops', label: 'Excentrische heel drops (3x15 per been)' },
        { id: 'heupmobiliteit', label: 'Mobiliteit heup 5 min' },
      ],
    },
    permanentReplacements: {},
    checkins: {},
    protein: {},
    maintenance: {},
    sessions: {},
    runs: {},
    skips: {},
    moves: {},
    overrides: {},
    exerciseState: {},
    notices: [],
    lastExportAt: null,
  }
}

/**
 * Tilt opgeslagen data naar de huidige schemaVersion en vult ontbrekende velden aan.
 * Oude data wordt opgehoogd, niet geweigerd of gewist. Crasht nooit op half-lege data.
 */
export function migrate(raw: unknown): AppState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base

  const incoming = raw as RawState
  const from = typeof incoming.schemaVersion === 'number' ? incoming.schemaVersion : 1
  const migrated = from < SCHEMA_VERSION ? runMigrations(incoming, from, SCHEMA_VERSION) : incoming
  const s = migrated as Partial<AppState>
  const settings = { ...base.settings, ...(s.settings ?? {}) }
  settings.sensitive = { ...base.settings.sensitive, ...(s.settings?.sensitive ?? {}) }
  if (!Array.isArray(settings.maintenanceItems)) {
    settings.maintenanceItems = base.settings.maintenanceItems
  }
  return {
    ...base,
    ...s,
    schemaVersion: SCHEMA_VERSION,
    startDate: typeof s.startDate === 'string' ? s.startDate : base.startDate,
    settings,
    permanentReplacements: s.permanentReplacements ?? {},
    checkins: s.checkins ?? {},
    protein: s.protein ?? {},
    maintenance: s.maintenance ?? {},
    sessions: s.sessions ?? {},
    runs: s.runs ?? {},
    skips: s.skips ?? {},
    moves: s.moves ?? {},
    overrides: s.overrides ?? {},
    exerciseState: s.exerciseState ?? {},
    notices: Array.isArray(s.notices) ? s.notices : [],
    lastExportAt: typeof s.lastExportAt === 'string' ? s.lastExportAt : null,
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    return migrate(JSON.parse(raw))
  } catch {
    return defaultState()
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* quota vol of private mode: app blijft werken in geheugen */
  }
}

export function getState(): AppState {
  return state
}

export function setState(updater: (s: AppState) => AppState): void {
  state = updater(state)
  persist()
  emit()
}

export function replaceState(next: AppState): void {
  state = next
  persist()
  emit()
}

export function resetState(): void {
  replaceState(defaultState())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getState, getState)
}

/* ---------------- export / import ---------------- */

/** Bouwt de export en onthoudt wanneer er voor het laatst geëxporteerd is. */
export function exportJSON(): string {
  const stamp = new Date().toISOString()
  const payload = JSON.stringify({ ...state, lastExportAt: stamp, exportedAt: stamp }, null, 2)
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
  replaceState(migrate(parsed))
  return { ok: true }
}
