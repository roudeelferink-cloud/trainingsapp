import { BY_ID } from '../data/exercises'
import type { Exercise, LoggedSet, SessionLog, UserState } from '../types'
import { sortByDate } from './backfill'
import { bandLabel, isBandExercise, levelOf } from './band'
import { addDays, mondayOf, today } from './dates'
import { DUMBBELL_WEIGHT_UNIT, isDumbbell } from './dumbbell'
import { fmt } from './progression'

/**
 * Wat je van een oefening al gedaan hebt.
 *
 * De app wist het allemaal al — het stond in `state.sessions` — maar nergens stond het
 * per oefening bij elkaar. Dat is precies wat je in de sportschool wilt weten: wat tilde
 * ik hier de vorige keer, en hoe liep dat de afgelopen maanden.
 *
 * **Op datum, niet op invoermoment.** Alles hieronder loopt over `SessionLog.date` en
 * niet over `completedAt`. Een sessie van vorige week die je vandaag achteraf invulde
 * heeft het jongste invoermoment van allemaal, maar hij is niet de vorige keer van
 * vandaag — hij hoort op zijn eigen dag in de rij. Alleen bij twee sessies op dezelfde
 * dag beslist het invoermoment, en dat is dan ook de enige plek waar het meetelt.
 *
 * **Alleen afgeronde sessies.** Een concept waar je middenin zit is nog geen historie.
 */

export interface ExerciseSession {
  /** de dag waarover de sessie ging */
  date: string
  /** de sessiesleutel, zodat een scherm terug kan naar het log zelf */
  key: string
  /** het slot waarin deze oefening stond */
  slotKey: string
  /** de gelogde sets, in de volgorde waarin ze gedaan zijn */
  sets: LoggedSet[]
  /** de zwaarste set: kilo's, of het bandniveau bij bandwerk */
  top: number
}

/** De zwaarste set van een reeks: kilo's, of het niveau bij bandwerk. */
export function topOf(ex: Exercise, sets: LoggedSet[]): number {
  if (sets.length === 0) return 0
  return isBandExercise(ex)
    ? Math.max(...sets.map(levelOf))
    : Math.max(...sets.map((s) => s.weight))
}

/** De belasting van één set, in de eenheid die bij deze oefening hoort. */
function loadOf(ex: Exercise, set: LoggedSet): number {
  return isBandExercise(ex) ? levelOf(set) : set.weight
}

/**
 * Waar deze oefening in dit log stond, met de sets die er gelogd zijn.
 *
 * `exercises` zegt welke oefening er in een slot daadwerkelijk gedaan is — gewisseld,
 * gerouleerd of doorgegroeid, dat maakt niet uit. Staat de oefening er twee keer in
 * (zeldzaam, maar het kan: een extra oefening die toevallig dezelfde is), dan telt het
 * slot met de meeste sets.
 */
function sessionFor(log: SessionLog, exerciseId: string): ExerciseSession | null {
  let best: { slotKey: string; sets: LoggedSet[] } | null = null
  for (const [slotKey, id] of Object.entries(log.exercises ?? {})) {
    if (id !== exerciseId) continue
    const sets = (log.entries?.[slotKey] ?? []).filter((s) => s.done !== false && s.reps > 0)
    if (sets.length === 0) continue
    if (!best || sets.length > best.sets.length) best = { slotKey, sets }
  }
  if (!best) return null
  const ex = BY_ID[exerciseId]
  return {
    date: log.date,
    key: `${log.date}:${log.kind}`,
    slotKey: best.slotKey,
    sets: best.sets,
    top: ex ? topOf(ex, best.sets) : 0,
  }
}

/**
 * De laatste afgeronde sessie waarin deze oefening zat, vóór `beforeIso`.
 *
 * Sessietype doet niet mee: leg press in een beensessie en leg press in een full body
 * zijn dezelfde oefening voor je benen, en de vorige keer is de vorige keer.
 */
export function lastSessionFor(
  state: UserState,
  exerciseId: string,
  beforeIso: string,
): ExerciseSession | null {
  const logs = Object.values(state.sessions ?? {}).filter(
    (log) => !!log?.completedAt && log.date < beforeIso,
  )
  for (const log of sortByDate(logs)) {
    const found = sessionFor(log, exerciseId)
    if (found) return found
  }
  return null
}

/**
 * Alle afgeronde sessies met deze oefening in de laatste `weeks` weken, oudste eerst.
 *
 * Oudste eerst omdat dat de volgorde van een verloop is; een lijst die de nieuwste
 * bovenaan wil, draait hem om. Het venster begint op de maandag van `weeks` weken terug,
 * zodat het meebeweegt met de weken waar de rest van de app in rekent.
 */
export function historyFor(
  state: UserState,
  exerciseId: string,
  weeks: number,
  vandaag: string = today(),
): ExerciseSession[] {
  const start = addDays(mondayOf(vandaag), -7 * Math.max(0, weeks - 1))
  const out: ExerciseSession[] = []
  for (const log of Object.values(state.sessions ?? {})) {
    if (!log?.completedAt || log.date < start) continue
    const found = sessionFor(log, exerciseId)
    if (found) out.push(found)
  }
  return out.sort((a, b) => (a.date === b.date ? a.key.localeCompare(b.key) : a.date < b.date ? -1 : 1))
}

export interface LoggedExercise {
  exerciseId: string
  naam: string
  /** de laatste dag waarop je hem deed */
  last: string
  /** aantal afgeronde sessies waarin hij zat */
  sessions: number
}

/**
 * Elke oefening die ooit gelogd is, laatst gedaan bovenaan. Oefeningen die niet meer in
 * de bibliotheek staan vallen weg: daar valt geen pagina van te maken.
 */
export function loggedExercises(state: UserState): LoggedExercise[] {
  const byId = new Map<string, { last: string; sessions: number }>()

  for (const log of Object.values(state.sessions ?? {})) {
    if (!log?.completedAt) continue
    for (const [slotKey, id] of Object.entries(log.exercises ?? {})) {
      if (!BY_ID[id]) continue
      const sets = (log.entries?.[slotKey] ?? []).filter((s) => s.done !== false && s.reps > 0)
      if (sets.length === 0) continue
      const cur = byId.get(id)
      byId.set(id, {
        last: cur && cur.last > log.date ? cur.last : log.date,
        sessions: (cur?.sessions ?? 0) + 1,
      })
    }
  }

  return [...byId.entries()]
    .map(([exerciseId, x]) => ({ exerciseId, naam: BY_ID[exerciseId].naam, ...x }))
    .sort((a, b) => (a.last === b.last ? a.naam.localeCompare(b.naam) : a.last < b.last ? 1 : -1))
}

/* -------------------------------------------------------------------------
 * Hoe een gelogde set eruitziet
 * ---------------------------------------------------------------------- */

export interface SetLabel {
  /** "100 × 12", of "niveau 2 × 15" bij bandwerk */
  text: string
  /**
   * Deze set stond lichter dan de zwaarste van diezelfde sessie: onderweg naar beneden
   * bijgesteld. Dat is geen fout en geen straf — het is wat er gebeurde — maar het is wel
   * de reden dat de opbouwregel die sessie niet meetelt, dus hoor je het te kunnen zien.
   */
  down: boolean
}

/**
 * Een gewicht zoals het in een regel tekst hoort: Nederlands, met een komma. `fmt` doet
 * het afronden; de komma hoort erbij zodra het getal in een zin staat in plaats van in
 * een invoerveld.
 */
export function weightLabel(kg: number): string {
  return fmt(kg).replace('.', ',')
}

/** De sets van één sessie, compact: gewicht × reps, met de conventie van de oefening. */
export function setLabels(ex: Exercise, sets: LoggedSet[]): SetLabel[] {
  const top = topOf(ex, sets)
  return sets.map((s) => ({
    text: isBandExercise(ex)
      ? `${bandLabel(levelOf(s))} × ${s.reps}`
      : `${weightLabel(s.weight)} × ${s.reps}`,
    down: loadOf(ex, s) < top - 1e-9,
  }))
}

/**
 * De eenheid die achter een reeks sets hoort, of leeg als het getal voor zich spreekt.
 * Bij dumbbells is dat niet vanzelfsprekend: daar staat het gewicht van één dumbbell.
 */
export function setsUnit(ex: Exercise): string {
  return !isBandExercise(ex) && isDumbbell(ex) ? DUMBBELL_WEIGHT_UNIT : ''
}
