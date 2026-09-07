import { beforeEach, describe, expect, it } from 'vitest'
import {
  BACKFILL_WEEKS,
  backfillNotice,
  backfillStart,
  hasLaterLogFor,
  isBackfillDate,
  isBackfilled,
  isTooOld,
  missedInWeek,
  missedSessions,
} from '../src/logic/backfill'
import { addDays, weekday } from '../src/logic/dates'
import { buildDay } from '../src/logic/day'
import { afterEasySession, previousStrengthLog } from '../src/logic/extra'
import { stateFor } from '../src/logic/progression'
import { weekRunFacts } from '../src/logic/runningLoad'
import * as A from '../src/store/actions'
import { ANOUC, ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'
import type { DayKind, LoggedSet, SessionLog } from '../src/types'
import { DI, DO, MON, VR, WO, ZA, ZO } from './helpers'

/**
 * Achteraf invullen: een sessie van een eerdere dag alsnog loggen.
 *
 * Twee dingen worden hier bewaakt. Ten eerste het venster — de lopende week plus de week
 * ervoor, en geen dag verder. Ten tweede de volgorde van de progressie: een sessie van
 * dinsdag die je op donderdag invult mag de streefgewichten niet terugdraaien naar wat ze
 * dinsdag waren.
 */

const VANDAAG = ZO // zondag 9 aug 2026, met MON als maandag van die week

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: MON }))
})

describe('het terugwerkende venster', () => {
  it('loopt tot en met de maandag van de week ervoor', () => {
    expect(BACKFILL_WEEKS).toBe(1)
    expect(backfillStart(VANDAAG)).toBe(addDays(MON, -7))
  })

  it('neemt elke dag van deze week en de week ervoor mee, behalve vandaag zelf', () => {
    for (const iso of [MON, DI, WO, DO, VR, ZA, addDays(MON, -7), addDays(MON, -1)]) {
      expect(isBackfillDate(iso, VANDAAG), iso).toBe(true)
    }
    expect(isBackfillDate(VANDAAG, VANDAAG)).toBe(false)
  })

  it('laat wat verder terug ligt en wat nog moet komen buiten het venster', () => {
    const teOud = addDays(MON, -8)
    expect(isBackfillDate(teOud, VANDAAG)).toBe(false)
    expect(isTooOld(teOud, VANDAAG)).toBe(true)
    expect(isTooOld(MON, VANDAAG)).toBe(false)
    // morgen is geen gemiste dag
    expect(isBackfillDate(addDays(VANDAAG, 1), VANDAAG)).toBe(false)
  })

  it('zegt bij een eerdere dag dat hij op zijn eigen datum landt', () => {
    const tekst = backfillNotice(VR, VANDAAG)
    expect(tekst).toContain('vrijdag')
    expect(tekst).toContain('niet op vandaag')
    expect(backfillNotice(VANDAAG, VANDAAG)).toBe('')
  })
})

describe('wat er nog open staat', () => {
  it('noemt de krachtsessies en de lopen die niet gedaan en niet overgeslagen zijn', () => {
    const gemist = missedSessions(getState(), VANDAAG)
    expect(gemist.some((m) => m.date === MON && m.what === 'strength' && m.kind === 'legs_a')).toBe(true)
    expect(gemist.some((m) => m.date === DI && m.what === 'run' && m.naam === 'Korte loop')).toBe(true)
  })

  it('laat de rustdag er nooit in staan', () => {
    const program = weekday(WO)
    expect(missedSessions(getState(), VANDAAG).some((m) => weekday(m.date) === program)).toBe(false)
  })

  it('houdt de volgorde aan: oudste dag eerst, en per dag eerst de loop', () => {
    const gemist = missedSessions(getState(), VANDAAG)
    const datums = gemist.map((m) => m.date)
    expect([...datums].sort()).toEqual(datums)

    const dinsdag = gemist.filter((m) => m.date === DI).map((m) => m.what)
    expect(dinsdag).toEqual(['run', 'strength'])
  })

  it('haalt een afgevinkte sessie uit de lijst', () => {
    const slots = buildDay(getState(), MON).strength!.slots.slice(0, 1)
    A.completeSession(MON, 'legs_a', slots, {
      [slots[0].slot.key]: [{ weight: 60, reps: 10, done: true }],
    }, false, [slots[0].slot.key])

    expect(missedSessions(getState(), VANDAAG).some((m) => m.date === MON && m.what === 'strength')).toBe(false)
  })

  it('haalt een overgeslagen loop uit de lijst', () => {
    A.skipSession(DI, 'run', 'druk')
    expect(missedSessions(getState(), VANDAAG).some((m) => m.date === DI && m.what === 'run')).toBe(false)
  })

  it('valt niet buiten het venster', () => {
    const gemist = missedSessions(getState(), VANDAAG)
    expect(gemist.every((m) => isBackfillDate(m.date, VANDAAG))).toBe(true)
  })

  it('knipt per week, voor het weekscherm', () => {
    const dezeWeek = missedInWeek(getState(), MON, VANDAAG)
    expect(dezeWeek.length).toBeGreaterThan(0)
    expect(dezeWeek.every((m) => m.date >= MON && m.date <= ZA)).toBe(true)
  })

  it('werkt ook voor het andere profiel, met zijn eigen rustdag', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    const gemist = missedSessions(getState(), VANDAAG)
    // maandag is bij Anouc de rustdag
    expect(gemist.some((m) => m.date === MON)).toBe(false)
    expect(gemist.some((m) => m.date === WO && m.kind === 'full_body_a')).toBe(true)
  })
})

/* -------------------------------------------------------------------------
 * De sessie zelf
 * ---------------------------------------------------------------------- */

/** Zet streefgewichten neer zodat er iets te verhogen valt. */
function metStreefgewicht(): void {
  setState((s) => ({
    ...s,
    startDate: addDays(MON, -21), // voorbij de kalibratieweken
    exerciseState: {
      ...s.exerciseState,
      leg_press: {
        targetWeight: 140,
        targetReps: 10,
        belowMinStreak: 0,
        lastNote: null,
        lastUpdated: null,
        hitStreak: 0,
      },
    },
  }))
}

/** Logt de eerste oefening van de beensessie van `iso`, alles gehaald. */
function logEersteOefening(iso: string): { kind: DayKind; exerciseId: string } {
  const strength = buildDay(getState(), iso).strength!
  const r = strength.slots[0]
  const sets: LoggedSet[] = Array.from({ length: r.sets }, () => ({
    weight: 140,
    reps: 10,
    done: true,
  }))
  A.completeSession(iso, strength.kind, [r], { [r.slot.key]: sets }, false, [r.slot.key])
  return { kind: strength.kind, exerciseId: r.exercise.id }
}

describe('een sessie die achteraf ingevuld wordt', () => {
  it('landt op zijn eigen datum, met de dag van invullen erbij', () => {
    metStreefgewicht()
    const { kind } = logEersteOefening(MON)
    const log = getState().sessions[`${MON}:${kind}`]

    expect(log.date).toBe(MON)
    expect(isBackfilled(log)).toBe(true)
    expect(log.backfilledOn).not.toBe(MON)
    // en er staat niets op de dag van invullen
    expect(getState().sessions[`${log.backfilledOn}:${kind}`]).toBeUndefined()
  })

  it('stuurt de streefgewichten gewoon als er niets nieuwers staat', () => {
    metStreefgewicht()
    const { exerciseId } = logEersteOefening(MON)
    expect(stateFor(getState(), exerciseId).hitStreak).toBe(1)
  })

  it('laat de streefgewichten met rust zodra er een nieuwere sessie staat', () => {
    metStreefgewicht()
    const volgendeMaandag = addDays(MON, 7)

    // eerst de nieuwe sessie, daarna de oude alsnog invullen
    logEersteOefening(volgendeMaandag)
    const na = stateFor(getState(), 'leg_press')

    const { kind } = logEersteOefening(MON)
    const daarna = stateFor(getState(), 'leg_press')

    expect(daarna.hitStreak).toBe(na.hitStreak)
    expect(daarna.targetWeight).toBe(na.targetWeight)
    // maar de sessie is er wel
    expect(getState().sessions[`${MON}:${kind}`].completedAt).not.toBeNull()
  })

  it('legt uit waarom de gewichten blijven staan', () => {
    metStreefgewicht()
    logEersteOefening(addDays(MON, 7))

    const strength = buildDay(getState(), MON).strength!
    const r = strength.slots[0]
    const sets: LoggedSet[] = Array.from({ length: r.sets }, () => ({
      weight: 140,
      reps: 10,
      done: true,
    }))
    const messages = A.completeSession(MON, strength.kind, [r], { [r.slot.key]: sets }, false, [r.slot.key])

    expect(messages.join(' ')).toContain('Achteraf ingevuld')
    expect(messages.join(' ')).toContain(r.exercise.naam)
  })

  it('kijkt per oefening, niet per sessie', () => {
    metStreefgewicht()
    const volgendeMaandag = addDays(MON, 7)
    logEersteOefening(volgendeMaandag) // alleen leg press

    // dezelfde oude sessie, nu met twee oefeningen: de tweede staat nergens nieuwer
    const strength = buildDay(getState(), MON).strength!
    const twee = strength.slots.slice(0, 2)
    const entries = Object.fromEntries(
      twee.map((r) => [r.slot.key, [{ weight: 40, reps: r.repMax, done: true }]]),
    )
    A.completeSession(MON, strength.kind, twee, entries, false, twee.map((r) => r.slot.key))

    // de tweede oefening heeft wél een streefgewicht gekregen van deze sessie
    expect(stateFor(getState(), twee[1].exercise.id).targetWeight).toBe(40)
  })

  it('krijgt geen nabeschouwing over een te makkelijke sessie', () => {
    metStreefgewicht()
    const strength = buildDay(getState(), MON).strength!
    const slots = strength.slots
    const entries = Object.fromEntries(
      slots.map((r) => [r.slot.key, [{ weight: 40, reps: r.repMax, done: true }]]),
    )
    A.completeSession(MON, strength.kind, slots, entries, false, slots.map((r) => r.slot.key), 'makkelijk')

    expect(afterEasySession(getState(), MON, strength.kind, slots, 60)).toEqual({
      kind: 'niets',
      reason: 'achteraf',
    })
  })
})

describe('welke sessie de vorige is', () => {
  it('kijkt naar de datum en niet naar wanneer je hem invulde', () => {
    const nieuw: SessionLog = {
      date: DO,
      kind: 'pull',
      short: false,
      entries: {},
      exercises: {},
      skippedSlots: [],
      completedSlots: [],
      completedAt: '2026-08-06T18:00:00.000Z',
    }
    // de oudere sessie is als laatste ingevuld en heeft dus het jongste invoermoment
    const oud: SessionLog = {
      ...nieuw,
      date: DI,
      kind: 'push',
      completedAt: '2026-08-20T20:00:00.000Z',
      backfilledOn: '2026-08-20',
    }
    setState((s) => ({
      ...s,
      sessions: { [`${DO}:pull`]: nieuw, [`${DI}:push`]: oud },
    }))

    expect(previousStrengthLog(getState(), VR, 'legs_b')?.date).toBe(DO)
  })
})

describe('een loop die achteraf ingevuld wordt', () => {
  it('telt in de week waar hij in valt, niet in de week van invullen', () => {
    A.completeRun(DI, 'short', { plannedKm: 6, km: 6, minutes: 36, bike: false, feel: 'goed' })

    const log = getState().runs[DI]
    expect(log.date).toBe(DI)
    expect(isBackfilled(log)).toBe(true)
    expect(weekRunFacts(getState(), MON).km).toBe(6)
    expect(weekRunFacts(getState(), MON).aantal).toBe(1)
  })
})

describe('hasLaterLogFor', () => {
  it('ziet alleen afgeronde sessies van een latere datum', () => {
    const log: SessionLog = {
      date: DO,
      kind: 'pull',
      short: false,
      entries: { 'pull:0': [{ weight: 40, reps: 10, done: true }] },
      exercises: { 'pull:0': 'lat_pulldown' },
      skippedSlots: [],
      completedSlots: [],
      completedAt: 'x',
    }
    setState((s) => ({ ...s, sessions: { [`${DO}:pull`]: log } }))

    expect(hasLaterLogFor(getState(), DI, 'lat_pulldown')).toBe(true)
    expect(hasLaterLogFor(getState(), DO, 'lat_pulldown')).toBe(false) // zelfde dag telt niet
    expect(hasLaterLogFor(getState(), ZO, 'lat_pulldown')).toBe(false)
    expect(hasLaterLogFor(getState(), DI, 'leg_press')).toBe(false)
  })

  it('telt een concept dat nog niet afgerond is niet mee', () => {
    const concept: SessionLog = {
      date: DO,
      kind: 'pull',
      short: false,
      entries: {},
      exercises: { 'pull:0': 'lat_pulldown' },
      skippedSlots: [],
      completedSlots: [],
      completedAt: null,
    }
    setState((s) => ({ ...s, sessions: { [`${DO}:pull`]: concept } }))
    expect(hasLaterLogFor(getState(), DI, 'lat_pulldown')).toBe(false)
  })
})

describe('de deloadtelling en het rollend gemiddelde blijven kloppen', () => {
  it('telt een achteraf ingevulde zware sessie op zijn eigen dag mee', () => {
    metStreefgewicht()
    const strength = buildDay(getState(), MON).strength!
    const r = strength.slots[0]
    A.completeSession(MON, strength.kind, [r], {
      [r.slot.key]: [{ weight: 100, reps: 8, done: true }],
    }, false, [r.slot.key], 'zwaar')

    // de beoordeling hangt aan de datum van de sessie, niet aan de dag van invullen
    expect(getState().sessions[`${MON}:${strength.kind}`].feel).toBe('zwaar')
    expect(getState().sessions[`${MON}:${strength.kind}`].date).toBe(MON)
  })
})
