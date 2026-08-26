import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../src/data/plan'
import { getExercise } from '../src/data/exercises'
import { drempelFor } from '../src/logic/opbouw'
import { stateFor } from '../src/logic/progression'
import type { ResolvedSlot } from '../src/logic/select'
import * as A from '../src/store/actions'
import { ANOUC, ROB, getState, migrate, replaceRoot, setCurrentUser, setState } from '../src/store/store'
import type { AppState, DayKind, LoggedSet, SessionLog } from '../src/types'

/**
 * De nieuwe regel over een bestaande historie heen.
 *
 * Dit draait de gelogde sessies uit `fixtures/export-pages-v14.json` opnieuw af door de
 * echte `completeSession`, en telt hoe vaak het gewicht omhoog zou zijn gegaan. Niet met
 * een nagebouwde versie van de regel: met de regel zelf, want een replay die zijn eigen
 * rekenwerk meeneemt bewijst alleen dat hij met zichzelf overweg kan.
 *
 * **Wat deze historie is.** Het bestand is de uitvoer van de `exportJSON()` van de
 * Pages-versie, gevuld met negen weken opgebouwde sessies. Het is dus geen export van een
 * telefoon: de sessies zijn gemaakt om het import-pad te testen, niet om echte training
 * te beschrijven. De uitkomst hieronder zegt daarom iets over de regel, en niets over hoe
 * hard er getraind is.
 */

const EXPORT = JSON.parse(
  readFileSync(new URL('./fixtures/export-pages-v14.json', import.meta.url), 'utf8'),
) as AppState

export interface Telling {
  profiel: string
  sessies: number
  /** per oefening: hoe vaak het gewicht omhoog ging */
  verhogingen: Record<string, number>
  /** per oefening: de langste reeks gehaalde sessies op rij */
  langsteReeks: Record<string, number>
  /** per oefening: hoe vaak een sessie meetelde */
  gehaald: Record<string, number>
  /** per oefening: waarom een sessie niet meetelde */
  redenen: Record<string, string>
}

/** De sets en het aantal geplande sets van één slot uit het sjabloon. */
function slotVan(kind: DayKind, slotKey: string): ResolvedSlot | null {
  const tpl = TEMPLATES[kind]
  const index = Number(slotKey.split(':')[1])
  const slot = tpl?.slots[index]
  if (!slot) return null
  return {
    slot,
    exercise: getExercise(slot.exerciseId),
    sets: slot.setsReps.sets,
    repMin: slot.setsReps.repMin,
    repMax: slot.setsReps.repMax,
    reasons: [],
  }
}

/**
 * Speelt de historie van één profiel opnieuw af.
 *
 * Het startpunt is bewust mager: een schone staat met per oefening het gewicht van de
 * eerste sessie als streefgewicht, en de ondergrens van het sjabloon als streefreps. Wat
 * er in de export als eindstand staat wordt niet gebruikt — dat is de uitkomst van de
 * óúde regel, en die zou de replay laten beginnen waar hij hoort te eindigen.
 */
function replay(userId: string): Telling {
  const root = migrate(structuredClone(EXPORT))
  const user = root.users[userId]
  const logs = Object.values(user.sessions)
    .filter((log): log is SessionLog => !!log.completedAt)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  // schone staat: geen sessies, geen streefgewichten
  replaceRoot({ ...root, currentUser: userId })
  setCurrentUser(userId)
  setState((s) => ({ ...s, sessions: {}, exerciseState: {}, notices: [] }))

  const verhogingen: Record<string, number> = {}
  const langsteReeks: Record<string, number> = {}
  const gehaald: Record<string, number> = {}
  const redenen: Record<string, string> = {}

  for (const log of logs) {
    const slots: ResolvedSlot[] = []
    const entries: Record<string, LoggedSet[]> = {}

    for (const [slotKey, sets] of Object.entries(log.entries ?? {})) {
      const exerciseId = log.exercises?.[slotKey]
      if (!exerciseId) continue
      const r = slotVan(log.kind, slotKey)
      if (!r || r.exercise.id !== exerciseId) continue
      slots.push(r)
      entries[slotKey] = sets.map((s) => ({ ...s, done: true }))

      // het eerste gewicht is het vertrekpunt; daarna stuurt de regel zelf
      if (stateFor(getState(), exerciseId).targetWeight === null) {
        const start = Math.max(...sets.map((s) => s.weight))
        if (start > 0) {
          setState((s) => ({
            ...s,
            exerciseState: {
              ...s.exerciseState,
              [exerciseId]: {
                ...stateFor(s, exerciseId),
                targetWeight: start,
                targetReps: r.repMin,
              },
            },
          }))
        }
      }
    }
    if (slots.length === 0) continue

    const voor = new Map(slots.map((r) => [r.exercise.id, stateFor(getState(), r.exercise.id)]))
    A.completeSession(
      log.date,
      log.kind,
      slots,
      entries,
      false,
      slots.map((r) => r.slot.key),
    )

    for (const r of slots) {
      const id = r.exercise.id
      const na = stateFor(getState(), id)
      const eerder = voor.get(id)!

      if ((na.targetWeight ?? 0) > (eerder.targetWeight ?? 0) + 1e-9) {
        verhogingen[id] = (verhogingen[id] ?? 0) + 1
      }
      if ((na.hitStreak ?? 0) > (eerder.hitStreak ?? 0)) {
        gehaald[id] = (gehaald[id] ?? 0) + 1
      } else if (!redenen[id]) {
        const doelReps = eerder.targetReps ?? r.repMin
        const sets = entries[r.slot.key]
        redenen[id] =
          sets.length < r.sets
            ? `${sets.length} van de ${r.sets} sets gelogd`
            : sets.some((s) => s.reps < doelReps)
              ? `reps onder de ${doelReps}`
              : `gewicht onder het streefgewicht`
      }
      langsteReeks[id] = Math.max(langsteReeks[id] ?? 0, na.hitStreak ?? 0)
    }
  }

  return {
    profiel: userId,
    sessies: logs.length,
    verhogingen,
    langsteReeks,
    gehaald,
    redenen,
  }
}

describe('de nieuwe regel over de historie in fixtures/', () => {
  const tellingen = [replay(ROB), replay(ANOUC)]

  it('draait de hele historie zonder ergens op te breken', () => {
    for (const t of tellingen) {
      expect(t.sessies, t.profiel).toBeGreaterThan(10)
    }
  })

  it('vuurt op deze historie geen enkele keer, en dat klopt', () => {
    /*
      In deze sessies staan twee van de vier geplande sets, en de tweede set haalt één
      rep minder dan de eerste. Beide voorwaarden zijn dus niet gehaald, en dan hoort er
      niets omhoog te gaan. Dat is precies wat je wilt zien: de regel telt alleen mee wat
      helemaal af is.
    */
    for (const t of tellingen) {
      expect(Object.values(t.verhogingen), t.profiel).toEqual([])
      expect(Object.values(t.langsteReeks).every((n) => n === 0), t.profiel).toBe(true)
    }
  })

  it('noemt per oefening waarom de sessie niet meetelde', () => {
    for (const t of tellingen) {
      expect(Object.keys(t.redenen).sort(), t.profiel).toEqual(['bench_smith', 'leg_press'])
      for (const reden of Object.values(t.redenen)) {
        expect(reden, t.profiel).toContain('sets gelogd')
      }
    }
  })

  it('gaat wél omhoog zodra dezelfde historie compleet gelogd is', () => {
    // dezelfde sessies, maar met alle geplande sets op dezelfde reps: dan telt hij mee
    const root = migrate(structuredClone(EXPORT))
    replaceRoot({ ...root, currentUser: ROB })
    setCurrentUser(ROB)
    setState((s) => ({ ...s, sessions: {}, exerciseState: {}, notices: [] }))

    const logs = Object.values(root.users[ROB].sessions)
      .filter((log): log is SessionLog => !!log.completedAt && log.kind === 'legs_a')
      .sort((a, b) => (a.date < b.date ? -1 : 1))

    let verhogingen = 0
    for (const log of logs) {
      const r = slotVan('legs_a', 'legs_a:0')!
      const gewicht = Math.max(...(log.entries['legs_a:0'] ?? []).map((s) => s.weight))
      if (stateFor(getState(), r.exercise.id).targetWeight === null) {
        setState((s) => ({
          ...s,
          exerciseState: {
            ...s.exerciseState,
            [r.exercise.id]: { ...stateFor(s, r.exercise.id), targetWeight: gewicht, targetReps: r.repMin },
          },
        }))
      }
      const streef = stateFor(getState(), r.exercise.id)
      const sets: LoggedSet[] = Array.from({ length: r.sets }, () => ({
        weight: streef.targetWeight ?? gewicht,
        reps: streef.targetReps ?? r.repMin,
        rir: 2,
        done: true,
      }))

      const voor = stateFor(getState(), r.exercise.id).targetWeight ?? 0
      A.completeSession(log.date, 'legs_a', [r], { 'legs_a:0': sets }, false, ['legs_a:0'])
      if ((stateFor(getState(), r.exercise.id).targetWeight ?? 0) > voor + 1e-9) verhogingen++
    }

    // negen beensessies, drempel 3: dat zijn er drie
    expect(logs).toHaveLength(9)
    expect(verhogingen).toBe(Math.floor(logs.length / drempelFor(getState().settings, getExercise('leg_press'))))
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(155)
  })
})
