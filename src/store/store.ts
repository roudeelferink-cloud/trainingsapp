import { useSyncExternalStore } from 'react'
import type { AppState, UserState } from '../types'
import {
  ANOUC,
  ROB,
  SCHEMA_VERSION,
  USER_SEEDS,
  defaultRoot,
  defaultState,
  defaultUser,
  isPin,
  migrate,
} from './schema'

/**
 * De store: wat er op dit toestel staat, en wie eraan mag komen.
 *
 * De vorm van de staat en het migratiepad staan in `schema.ts` — die zijn ook buiten de
 * browser bruikbaar. Hier zit alles wat wél aan de browser vastzit: localStorage, de
 * abonnementen en de acties die schrijven.
 */
export { ANOUC, ROB, SCHEMA_VERSION, USER_SEEDS, defaultRoot, defaultState, defaultUser, isPin, migrate }

/** Het achtervoegsel is historisch; versiebeheer loopt via schemaVersion en migrations.ts. */
const KEY = 'trainingsapp.state.v1'

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

/**
 * Wisselen van profiel. Dit raakt alleen de keuze "wie gebruikt dit toestel": de
 * gegevens van beide gebruikers blijven staan, precies zoals ze waren.
 */
export function setCurrentUser(id: string): void {
  if (!root.users[id]) return
  replaceRoot({ ...root, currentUser: id })
}

/* ---------------- pincode en wissen ---------------- */

export function hasPin(): boolean {
  return isPin(root.pin)
}

export function setPin(code: string): boolean {
  if (!isPin(code)) return false
  replaceRoot({ ...root, pin: code })
  return true
}

/** Wijzigen kan alleen met de oude code erbij. */
export function changePin(oud: string, nieuw: string): boolean {
  if (!verifyPin(oud) || !isPin(nieuw)) return false
  return setPin(nieuw)
}

export function verifyPin(code: string): boolean {
  return isPin(root.pin) && code === root.pin
}

/**
 * Wist de gegevens van de opgegeven gebruikers: die krijgen een verse staat, de
 * andere blijven onaangeroerd. Daarna staat het toestel weer op de eerste-start-keuze,
 * zodat er geen leeg scherm overblijft.
 *
 * De pincode blijft staan: die hoort bij het toestel, niet bij de historie, en zonder
 * code zou de volgende wisactie helemaal niet meer kunnen.
 */
export function wipeUsers(ids: string[]): void {
  const users = { ...root.users }
  for (const id of ids) {
    const seed = USER_SEEDS.find((u) => u.id === id)
    if (!seed || !users[id]) continue
    users[id] = defaultUser(seed.id, users[id].naam, seed.programId)
  }
  replaceRoot({ ...root, users, currentUser: '' })
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
  // een bestand zonder gekozen gebruiker of pincode mag die van dit toestel niet wissen
  replaceRoot({
    ...next,
    currentUser: next.currentUser || root.currentUser,
    pin: next.pin ?? root.pin,
  })
  return { ok: true }
}
