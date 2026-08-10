import { TEMPLATES } from '../data/plan'
import { DEFAULT_BAR_WEIGHTS } from '../logic/barWeight'

/**
 * Migratiepad voor opgeslagen data.
 *
 * Elke functie tilt de staat van versie N naar N+1. Oude data wordt dus opgehoogd,
 * nooit geweigerd of gewist. Nieuwe versie toevoegen: verhoog SCHEMA_VERSION in
 * store.ts en zet hier de stap erbij onder de oude versienummer als sleutel.
 *
 * De functies werken op losse `unknown`-data, niet op AppState: oude vormen voldoen
 * per definitie niet aan het huidige type.
 */
export type RawState = Record<string, unknown>

/**
 * v1 -> v2: sessielogs kregen een `exercises`-map (slotKey -> exerciseId), zodat de
 * voortgangsgrafiek weet welke oefening er daadwerkelijk gedaan is. Oude logs vullen
 * we aan met de standaardoefening van dat slot.
 */
function v1_to_v2(state: RawState): RawState {
  const sessions = (state.sessions ?? {}) as Record<string, Record<string, unknown>>
  const next: Record<string, Record<string, unknown>> = {}

  for (const [key, log] of Object.entries(sessions)) {
    if (log && typeof log === 'object' && !log.exercises) {
      const entries = (log.entries ?? {}) as Record<string, unknown>
      const exercises: Record<string, string> = {}
      for (const slotKey of Object.keys(entries)) {
        const id = defaultExerciseForSlot(slotKey)
        if (id) exercises[slotKey] = id
      }
      next[key] = { ...log, exercises }
    } else {
      next[key] = log
    }
  }

  return { ...state, sessions: next, lastExportAt: state.lastExportAt ?? null }
}

/** Standaardoefening van een slot, op basis van de sjablonen. */
function defaultExerciseForSlot(slotKey: string): string | null {
  const [kind, index] = slotKey.split(':')
  const tpl = (TEMPLATES as Record<string, { slots: { exerciseId: string }[] } | undefined>)[kind]
  const slot = tpl?.slots[Number(index)]
  return slot?.exerciseId ?? null
}

/**
 * v2 -> v3: het sessiescherm vult nu een geschat startgewicht voor. Die schatting
 * leest gelogde gewichten terug, dus normaliseren we oude logs: elke set krijgt
 * gegarandeerd numerieke waarden en volledig lege sets uit afgeronde sessies
 * verdwijnen. Lopende concepten blijven ongemoeid.
 */
function v2_to_v3(state: RawState): RawState {
  const sessions = (state.sessions ?? {}) as Record<string, Record<string, unknown>>
  const next: Record<string, Record<string, unknown>> = {}

  for (const [key, log] of Object.entries(sessions)) {
    if (!log || typeof log !== 'object') {
      next[key] = log
      continue
    }
    const entries = (log.entries ?? {}) as Record<string, unknown>
    const cleaned: Record<string, { weight: number; reps: number; rir: number }[]> = {}
    for (const [slotKey, sets] of Object.entries(entries)) {
      const list = (Array.isArray(sets) ? sets : []).map((s) => {
        const set = (s ?? {}) as Record<string, unknown>
        return {
          weight: num(set.weight),
          reps: num(set.reps),
          rir: num(set.rir),
        }
      })
      cleaned[slotKey] = log.completedAt ? list.filter((s) => s.reps > 0 || s.weight > 0) : list
    }
    next[key] = { ...log, entries: cleaned }
  }

  return { ...state, sessions: next }
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * v3 -> v4: sets krijgen een expliciete `done`-vlag en sessies een `completedSlots`-
 * lijst (per oefening afgerond). Voorheen gold "reps ingevuld" als gelogd, dus oude
 * sets met reps > 0 worden als afgevinkt gemarkeerd.
 */
function v3_to_v4(state: RawState): RawState {
  const sessions = (state.sessions ?? {}) as Record<string, Record<string, unknown>>
  const next: Record<string, unknown> = {}

  for (const [key, log] of Object.entries(sessions)) {
    if (!log || typeof log !== 'object') {
      next[key] = log
      continue
    }
    const entries = (log.entries ?? {}) as Record<string, unknown>
    const marked: Record<string, unknown> = {}
    for (const [slotKey, sets] of Object.entries(entries)) {
      marked[slotKey] = (Array.isArray(sets) ? sets : []).map((s) => {
        const set = (s ?? {}) as Record<string, unknown>
        return { ...set, done: typeof set.done === 'boolean' ? set.done : num(set.reps) > 0 }
      })
    }
    next[key] = {
      ...log,
      entries: marked,
      completedSlots: Array.isArray(log.completedSlots) ? log.completedSlots : [],
    }
  }

  return { ...state, sessions: next }
}

/**
 * v4 -> v5: losse activiteiten naast het schema (fietsen, wandelen, ...). Oude data
 * kent die lijst nog niet en krijgt een lege. Bestaande sessies, loops en
 * oefeningstanden blijven onaangeroerd: activiteiten sturen geen progressie.
 */
function v4_to_v5(state: RawState): RawState {
  return { ...state, activities: normalizeActivities(state.activities) }
}

const ACTIVITY_TYPES = ['fietsen', 'wandelen', 'zwemmen', 'hardlopen', 'spinning', 'overig']
const ACTIVITY_INTENSITIES = ['rustig', 'normaal', 'intensief']
/** Alleen deze typen krijgen een afstand; bij de rest is km betekenisloos. */
const DISTANCE_TYPES = ['hardlopen', 'fietsen', 'wandelen']

function distanceOf(type: string, raw: unknown): number | null {
  if (!DISTANCE_TYPES.includes(type)) return null
  const km = num(raw)
  return km > 0 ? Math.round(km * 100) / 100 : null
}

/**
 * Maakt er bruikbare activiteiten van: onbekende types worden 'overig', een
 * onleesbare duur wordt 0 en records zonder id vervallen. Handgeschreven of
 * half-kapotte importbestanden mogen de app niet laten crashen.
 */
function normalizeActivities(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return []
  const out: unknown[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const a = item as Record<string, unknown>
    if (typeof a.id !== 'string' || typeof a.date !== 'string') continue
    const type = typeof a.type === 'string' && ACTIVITY_TYPES.includes(a.type) ? a.type : 'overig'
    out.push({
      id: a.id,
      date: a.date,
      type,
      minutes: Math.max(0, Math.round(num(a.minutes))),
      distanceKm: distanceOf(type, a.distanceKm),
      intensity:
        typeof a.intensity === 'string' && ACTIVITY_INTENSITIES.includes(a.intensity)
          ? a.intensity
          : 'normaal',
      note: typeof a.note === 'string' && a.note.trim() ? a.note.trim() : null,
      createdAt: typeof a.createdAt === 'string' ? a.createdAt : `${a.date}T00:00:00.000Z`,
    })
  }
  return out
}

/**
 * v5 -> v6: meerdere gebruikers. Tot en met v5 was de opgeslagen staat één platte
 * gebruiker; die was van Rob. Hij verhuist daarom ongewijzigd naar `users.rob`, en
 * dit toestel staat meteen op Rob ingesteld zodat er na de update niets verandert
 * aan wat je ziet. De huishoudcode blijft leeg: die vraagt de app bij de eerste
 * start, waarna Rob's historie onder die code komt te staan.
 *
 * Er gaat niets verloren: elk veld van de oude staat gaat mee, alleen `schemaVersion`
 * schuift naar het niveau erboven.
 */
function v5_to_v6(state: RawState): RawState {
  if (state.users && typeof state.users === 'object') return state
  const { schemaVersion: _versie, ...user } = state
  return {
    household: typeof state.household === 'string' ? state.household : '',
    currentUser: 'rob',
    users: { rob: { ...user, id: 'rob', naam: 'Rob', programId: 'kracht_hardlopen' } },
  }
}

/**
 * v6 -> v7: twee toevoegingen die allebei per gebruiker opgeslagen worden.
 *
 * 1. Stangen hebben een eigen gewicht. Je voert vanaf nu alleen de schijven in en
 *    de app telt de stang erbij, dus krijgt elke gebruiker de standaardgewichten in
 *    zijn instellingen. Bestaande logs blijven zoals ze zijn: daar staat het totaal
 *    in, en dat is precies wat de app nu ook opslaat.
 * 2. Losse activiteiten kunnen een afstand hebben. Bestaande activiteiten krijgen
 *    `distanceKm: null`; ze zijn destijds zonder afstand gelogd.
 * 3. Loopsessies zijn verplaatsbaar en krijgen daarvoor hun eigen `runMoves`,
 *    naast de bestaande `moves` voor krachtsessies. Die blijft ongemoeid.
 *
 * Vanaf v6 zit alles onder `users`, dus deze stap loopt de gebruikers langs.
 */
function v6_to_v7(state: RawState): RawState {
  const users = (state.users ?? {}) as Record<string, unknown>
  const next: Record<string, unknown> = {}

  for (const [id, raw] of Object.entries(users)) {
    if (!raw || typeof raw !== 'object') {
      next[id] = raw
      continue
    }
    const user = raw as Record<string, unknown>
    const settings = (user.settings ?? {}) as Record<string, unknown>
    const bars = (settings.barWeights ?? {}) as Record<string, unknown>
    const barWeights: Record<string, number> = { ...DEFAULT_BAR_WEIGHTS }
    for (const [bar, kg] of Object.entries(bars)) {
      if (bar in barWeights && num(kg) > 0) barWeights[bar] = num(kg)
    }
    next[id] = {
      ...user,
      settings: { ...settings, barWeights },
      activities: normalizeActivities(user.activities),
      runMoves: user.runMoves && typeof user.runMoves === 'object' ? user.runMoves : {},
    }
  }

  return { ...state, users: next }
}

export const MIGRATIONS: Record<number, (s: RawState) => RawState> = {
  1: v1_to_v2,
  2: v2_to_v3,
  3: v3_to_v4,
  4: v4_to_v5,
  5: v5_to_v6,
  6: v6_to_v7,
}

/**
 * Draait alle migratiestappen tussen `from` en `to`.
 * Ontbreekt er een stap, dan stopt hij daar; de daaropvolgende default-aanvulling
 * in migrate() zorgt dat de staat alsnog bruikbaar is.
 */
export function runMigrations(state: RawState, from: number, to: number): RawState {
  let out = state
  for (let v = from; v < to; v++) {
    const step = MIGRATIONS[v]
    if (!step) break
    out = step(out)
    out.schemaVersion = v + 1
  }
  return out
}
