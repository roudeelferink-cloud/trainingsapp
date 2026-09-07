import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getExercise } from '../src/data/exercises'
import { buildDay } from '../src/logic/day'
import { addDays, formatShort, mondayOf, today } from '../src/logic/dates'
import {
  historyFor,
  lastSessionFor,
  loggedExercises,
  setLabels,
  setsUnit,
  topOf,
} from '../src/logic/history'
import { ExerciseScreen } from '../src/screens/ExerciseScreen'
import { HistoryScreen } from '../src/screens/HistoryScreen'
import { SessionScreen } from '../src/screens/SessionScreen'
import * as A from '../src/store/actions'
import { ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'
import type { DayKind, LoggedSet, SessionLog } from '../src/types'

/**
 * Wat je van een oefening al gedaan hebt.
 *
 * Twee vragen, één bron. "Wat tilde ik hier de vorige keer" staat tijdens de sessie onder
 * de oefeningkop; "hoe liep dit de afgelopen maanden" staat op een eigen pagina onder
 * Historie. Allebei lezen ze `state.sessions` op datum, en niet op het moment waarop je
 * de sessie invulde.
 */

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

const MA = () => mondayOf(today())
const noop = () => {}

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: addDays(MA(), -21), settings: { ...s.settings, bodyweightKg: 82 } }))
})

function set(weight: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet {
  return { weight, reps, done: true, ...extra }
}

/** Legt een afgeronde sessie neer met precies deze oefening en deze sets. */
function log(
  date: string,
  kind: DayKind,
  exerciseId: string,
  sets: LoggedSet[],
  extra: Partial<SessionLog> = {},
): void {
  const key = `${date}:${kind}`
  const entry: SessionLog = {
    date,
    kind,
    short: false,
    completedAt: `${date}T18:00:00.000Z`,
    entries: { [`${kind}:0`]: sets },
    exercises: { [`${kind}:0`]: exerciseId },
    skippedSlots: [],
    completedSlots: [`${kind}:0`],
    ...extra,
  }
  setState((s) => ({ ...s, sessions: { ...s.sessions, [key]: entry } }))
}

describe('de vorige keer van een oefening', () => {
  it('pakt de laatste afgeronde sessie vóór die dag', () => {
    log(addDays(MA(), -14), 'legs_a', 'leg_press', [set(100, 10)])
    log(addDays(MA(), -7), 'legs_a', 'leg_press', [set(105, 10), set(105, 9)])

    const vorige = lastSessionFor(getState(), 'leg_press', MA())
    expect(vorige?.date).toBe(addDays(MA(), -7))
    expect(vorige?.sets).toHaveLength(2)
    expect(vorige?.top).toBe(105)
  })

  it('kijkt over sessietypes heen: dezelfde oefening is dezelfde oefening', () => {
    log(addDays(MA(), -7), 'legs_a', 'leg_press', [set(100, 10)])
    log(addDays(MA(), -2), 'full_body_a', 'leg_press', [set(110, 10)])

    expect(lastSessionFor(getState(), 'leg_press', MA())?.date).toBe(addDays(MA(), -2))
  })

  it('zet een achteraf ingevulde sessie op zijn eigen datum, niet op de dag van invullen', () => {
    // de oudere sessie is als laatste ingevuld en heeft dus het jongste invoermoment
    log(addDays(MA(), -2), 'legs_a', 'leg_press', [set(120, 10)])
    log(addDays(MA(), -5), 'legs_a', 'leg_press', [set(100, 10)], {
      completedAt: `${MA()}T20:00:00.000Z`,
      backfilledOn: MA(),
    })

    expect(lastSessionFor(getState(), 'leg_press', MA())?.top).toBe(120)
  })

  it('telt een concept dat nog niet afgerond is niet mee', () => {
    log(addDays(MA(), -3), 'legs_a', 'leg_press', [set(100, 10)], { completedAt: null })
    expect(lastSessionFor(getState(), 'leg_press', MA())).toBeNull()
  })

  it('telt een sessie van dezelfde dag niet mee: die is niet de vorige keer', () => {
    log(MA(), 'legs_a', 'leg_press', [set(100, 10)])
    expect(lastSessionFor(getState(), 'leg_press', MA())).toBeNull()
  })

  it('slaat sets over die niet afgevinkt zijn', () => {
    log(addDays(MA(), -3), 'legs_a', 'leg_press', [set(100, 10), set(100, 0, { done: false })])
    expect(lastSessionFor(getState(), 'leg_press', MA())?.sets).toHaveLength(1)
  })
})

describe('de historie van een oefening', () => {
  it('geeft de sessies binnen het venster, oudste eerst', () => {
    log(addDays(MA(), -7), 'legs_a', 'leg_press', [set(100, 10)])
    log(addDays(MA(), -21), 'legs_a', 'leg_press', [set(90, 10)])
    log(addDays(MA(), -14), 'legs_a', 'leg_press', [set(95, 10)])

    const reeks = historyFor(getState(), 'leg_press', 12)
    expect(reeks.map((s) => s.top)).toEqual([90, 95, 100])
  })

  it('laat wat buiten het venster valt weg', () => {
    log(addDays(MA(), -7), 'legs_a', 'leg_press', [set(100, 10)])
    log(addDays(MA(), -70), 'legs_a', 'leg_press', [set(80, 10)])

    expect(historyFor(getState(), 'leg_press', 12)).toHaveLength(2)
    expect(historyFor(getState(), 'leg_press', 4)).toHaveLength(1)
  })
})

describe('welke oefeningen er gelogd zijn', () => {
  it('zet de laatst gedane bovenaan, met het aantal sessies erbij', () => {
    log(addDays(MA(), -14), 'legs_a', 'leg_press', [set(100, 10)])
    log(addDays(MA(), -7), 'legs_a', 'leg_press', [set(105, 10)])
    log(addDays(MA(), -2), 'pull', 'lat_pulldown', [set(50, 10)])

    const lijst = loggedExercises(getState())
    expect(lijst.map((x) => x.exerciseId)).toEqual(['lat_pulldown', 'leg_press'])
    expect(lijst[1].sessions).toBe(2)
    expect(lijst[0].last).toBe(addDays(MA(), -2))
  })

  it('laat een sessie zonder gelogde sets erbuiten', () => {
    log(addDays(MA(), -2), 'pull', 'lat_pulldown', [])
    expect(loggedExercises(getState())).toEqual([])
  })
})

describe('hoe een reeks sets eruitziet', () => {
  it('zet gewicht en reps compact naast elkaar', () => {
    const labels = setLabels(getExercise('leg_press'), [set(100, 12), set(100, 12), set(100, 10)])
    expect(labels.map((l) => l.text)).toEqual(['100 × 12', '100 × 12', '100 × 10'])
    expect(labels.every((l) => !l.down)).toBe(true)
  })

  it('markeert een set die naar beneden bijgesteld is', () => {
    // dat is precies de set waardoor de opbouwregel de sessie niet meetelt
    const labels = setLabels(getExercise('leg_press'), [set(100, 10), set(90, 10)])
    expect(labels.map((l) => l.down)).toEqual([false, true])
  })

  it('houdt bij bandwerk het niveau aan in plaats van kilo\'s', () => {
    const band = getExercise('clamshell')
    const sets = [set(0, 20, { level: 2 }), set(0, 18, { level: 1 })]
    expect(topOf(band, sets)).toBe(2)
    expect(setLabels(band, sets)[0].text).toContain('niveau 2')
    expect(setLabels(band, sets)[1].down).toBe(true)
    expect(setsUnit(band)).toBe('')
  })

  it('zegt bij dumbbells dat het gewicht per dumbbell is', () => {
    expect(setsUnit(getExercise('db_shoulder_press'))).toBe('per dumbbell')
    expect(setsUnit(getExercise('leg_press'))).toBe('')
  })
})

describe('het sessiescherm toont de vorige keer', () => {
  it('zet datum en sets onder de oefeningkop', () => {
    const vorige = addDays(MA(), -7)
    log(vorige, 'legs_a', 'leg_press', [set(100, 12), set(100, 12), set(100, 10)])

    const kind = buildDay(getState(), MA()).strength!.kind
    A.setWarmupDone(MA(), kind, true)
    const html = render(createElement(SessionScreen, { date: MA(), kind, onClose: noop }))

    expect(html).toContain(formatShort(vorige))
    expect(html).toContain('100 × 12')
    expect(html).toContain('100 × 10')
  })

  it('zet het streefgewicht van nu erachter als het afwijkt', () => {
    log(addDays(MA(), -7), 'legs_a', 'leg_press', [set(100, 10)])
    setState((s) => ({
      ...s,
      exerciseState: {
        leg_press: {
          targetWeight: 102.5,
          targetReps: 10,
          belowMinStreak: 0,
          lastNote: null,
          lastUpdated: null,
        },
      },
    }))

    const kind = buildDay(getState(), MA()).strength!.kind
    A.setWarmupDone(MA(), kind, true)
    const html = render(createElement(SessionScreen, { date: MA(), kind, onClose: noop }))
    expect(html).toContain('nu 102,5')
  })

  it('zwijgt bij een oefening zonder historie', () => {
    const kind = buildDay(getState(), MA()).strength!.kind
    A.setWarmupDone(MA(), kind, true)
    const html = render(createElement(SessionScreen, { date: MA(), kind, onClose: noop }))
    expect(html).not.toContain(' × 12 · ')
  })
})

describe('de pagina per oefening', () => {
  it('staat als lijst onder Historie, laatst gedaan bovenaan', () => {
    log(addDays(MA(), -7), 'legs_a', 'leg_press', [set(100, 10)])
    log(addDays(MA(), -2), 'pull', 'lat_pulldown', [set(50, 10)])

    const html = render(createElement(HistoryScreen, { onOpenSettings: noop }))
    expect(html).toContain('Per oefening')
    expect(html.indexOf('Lat pulldown')).toBeLessThan(html.indexOf('Leg press'))
  })

  it('toont de lijn en de sessies, en verder niets om aan te zetten', () => {
    log(addDays(MA(), -14), 'legs_a', 'leg_press', [set(95, 10)])
    log(addDays(MA(), -7), 'legs_a', 'leg_press', [set(100, 12), set(95, 10)])

    const html = render(createElement(ExerciseScreen, { exerciseId: 'leg_press', onClose: noop }))
    expect(html).toContain('Leg press')
    expect(html).toContain('Zwaarste set per sessie')
    expect(html).toContain('<svg')
    expect(html).toContain('100 × 12')
    expect(html).toContain(formatShort(addDays(MA(), -14)))
    // alleen kijken: geen knoppen om te loggen of te verplaatsen
    expect(html).not.toContain('Verplaatsen')
    expect(html).not.toContain('Set 1 klaar')
    expect(html).not.toContain('Aanpassen')
  })

  it('zegt het gewoon als er in het venster niets staat', () => {
    const html = render(createElement(ExerciseScreen, { exerciseId: 'leg_press', onClose: noop }))
    expect(html).toContain('Nog niets gelogd')
  })

  it('toont bij bandwerk het niveau in plaats van kilo\'s', () => {
    log(addDays(MA(), -7), 'legs_a', 'clamshell', [set(0, 20, { level: 3 })])
    const html = render(createElement(ExerciseScreen, { exerciseId: 'clamshell', onClose: noop }))
    expect(html).toContain('Bandniveau per sessie')
    expect(html).toContain('niveau 3')
    expect(html).not.toContain('Zwaarste set')
  })
})
