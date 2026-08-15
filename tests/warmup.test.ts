import { beforeEach, describe, expect, it } from 'vitest'
import { buildDay } from '../src/logic/day'
import { addDays } from '../src/logic/dates'
import {
  DEFAULT_WARMUP,
  WARMUP_HINT,
  WARMUP_MAX_MINUTES,
  WARMUP_MIN_MINUTES,
  WARMUP_TYPES,
  clampWarmupMinutes,
  warmupLabel,
  warmupOf,
} from '../src/logic/warmup'
import * as A from '../src/store/actions'
import {
  ANOUC,
  ROB,
  getRoot,
  getState,
  migrate,
  replaceRoot,
  resetState,
  setCurrentUser,
  setState,
} from '../src/store/store'
import { MON } from './helpers'

const KEY = `${MON}:legs_a`

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: MON }))
})

describe('het warming-upblok', () => {
  it('staat standaard voor elke krachtsessie klaar', () => {
    const strength = buildDay(getState(), MON).strength!
    expect(strength.warmup).toEqual({ type: 'loopband', minutes: WARMUP_MIN_MINUTES, done: false })
    expect(WARMUP_MIN_MINUTES).toBe(5)
    expect(WARMUP_MAX_MINUTES).toBe(10)
    expect(WARMUP_HINT).toContain('5-10 min')
  })

  it('biedt loopband en losfietsen aan', () => {
    expect(WARMUP_TYPES.map((t) => t.id)).toEqual(['loopband', 'fiets'])
    expect(warmupLabel({ type: 'fiets', minutes: 8, done: false })).toBe('Losfietsen 8 min')
    expect(warmupLabel(DEFAULT_WARMUP)).toBe('Loopband 5 min')
  })

  it('laat het type wisselen', () => {
    A.setWarmupType(MON, 'legs_a', 'fiets')
    expect(buildDay(getState(), MON).strength!.warmup.type).toBe('fiets')

    A.setWarmupType(MON, 'legs_a', 'loopband')
    expect(buildDay(getState(), MON).strength!.warmup.type).toBe('loopband')
  })

  it('laat de duur instellen en houdt hem binnen redelijke grenzen', () => {
    A.setWarmupMinutes(MON, 'legs_a', 10)
    expect(buildDay(getState(), MON).strength!.warmup.minutes).toBe(10)

    A.setWarmupMinutes(MON, 'legs_a', 0)
    expect(buildDay(getState(), MON).strength!.warmup.minutes).toBe(1)

    A.setWarmupMinutes(MON, 'legs_a', 999)
    expect(buildDay(getState(), MON).strength!.warmup.minutes).toBe(60)

    expect(clampWarmupMinutes(7.4)).toBe(7)
    expect(clampWarmupMinutes(Number.NaN)).toBe(DEFAULT_WARMUP.minutes)
  })

  it('is af te vinken als onderdeel van de sessie', () => {
    A.setWarmupDone(MON, 'legs_a', true)
    expect(buildDay(getState(), MON).strength!.warmup.done).toBe(true)
    expect(getState().sessions[KEY].warmup).toEqual({ type: 'loopband', minutes: 5, done: true })
    // afvinken maakt de sessie zelf nog niet af
    expect(buildDay(getState(), MON).strength!.done).toBe(false)

    A.setWarmupDone(MON, 'legs_a', false)
    expect(buildDay(getState(), MON).strength!.warmup.done).toBe(false)
  })

  it('overleeft het opslaan van een setwijziging', () => {
    A.setWarmupType(MON, 'legs_a', 'fiets')
    A.setWarmupMinutes(MON, 'legs_a', 9)
    A.setWarmupDone(MON, 'legs_a', true)

    A.saveSessionDraft(
      MON,
      'legs_a',
      { 'legs_a:0': [{ weight: 100, reps: 10, rir: 2, done: true }] },
      { 'legs_a:0': 'leg_press' },
      false,
      [],
    )

    expect(buildDay(getState(), MON).strength!.warmup).toEqual({
      type: 'fiets',
      minutes: 9,
      done: true,
    })
  })

  it('blijft bij de sessie staan als die afgerond wordt', () => {
    A.setWarmupType(MON, 'legs_a', 'fiets')
    A.setWarmupDone(MON, 'legs_a', true)

    const slots = buildDay(getState(), MON).strength!.slots.slice(0, 1)
    const key = slots[0].slot.key
    A.completeSession(MON, 'legs_a', slots, {
      [key]: [{ weight: 100, reps: 10, rir: 1, done: true }],
    }, false, [key])

    const log = getState().sessions[KEY]
    expect(log.completedAt).not.toBeNull()
    expect(log.warmup).toEqual({ type: 'fiets', minutes: 5, done: true })
  })

  it('bewaart de keuze per sessie, niet voor de hele week', () => {
    A.setWarmupType(MON, 'legs_a', 'fiets')
    const dinsdag = addDays(MON, 1)
    expect(buildDay(getState(), dinsdag).strength!.warmup.type).toBe('loopband')
  })

  it('houdt de warming-up van beide gebruikers uit elkaar, ook na een herlaadbeurt', () => {
    A.setWarmupType(MON, 'legs_a', 'fiets')
    A.setWarmupMinutes(MON, 'legs_a', 8)

    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    const woensdag = addDays(MON, 2)
    expect(buildDay(getState(), woensdag).strength!.kind).toBe('full_body_a')
    A.setWarmupDone(woensdag, 'full_body_a', true)

    const opgeslagen = localStorage.getItem('trainingsapp.state.v1')
    replaceRoot(migrate(JSON.parse(opgeslagen!)))

    const root = getRoot()
    expect(buildDay(root.users[ROB], MON).strength!.warmup).toEqual({
      type: 'fiets',
      minutes: 8,
      done: false,
    })
    expect(buildDay(root.users[ANOUC], woensdag).strength!.warmup).toEqual({
      type: 'loopband',
      minutes: 5,
      done: true,
    })
  })

  it('geeft oude sessielogs zonder warming-up gewoon het standaardblok', () => {
    setState((s) => ({
      ...s,
      sessions: {
        [KEY]: {
          date: MON,
          kind: 'legs_a',
          short: false,
          completedAt: null,
          entries: {},
          exercises: {},
          skippedSlots: [],
          completedSlots: [],
        },
      },
    }))
    expect(buildDay(getState(), MON).strength!.warmup).toEqual(DEFAULT_WARMUP)
    expect(warmupOf(null)).toEqual(DEFAULT_WARMUP)
  })

  it('repareert een onmogelijke warming-up uit een geïmporteerd bestand', () => {
    expect(
      warmupOf({
        date: MON,
        kind: 'legs_a',
        short: false,
        completedAt: null,
        entries: {},
        exercises: {},
        skippedSlots: [],
        completedSlots: [],
        warmup: { type: 'onzin', minutes: -5, done: 1 } as never,
      }),
    ).toEqual({ type: 'loopband', minutes: 1, done: true })
  })
})
