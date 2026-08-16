import { describe, expect, it } from 'vitest'
import { getExercise } from '../src/data/exercises'
import {
  BODYWEIGHT_INTENSITY,
  CATEGORY_WEIGHT,
  DEFAULT_INTENSITY,
  LEG_LOAD_HIGH,
  LEG_LOAD_VERY_HIGH,
  intensityFactor,
  legCategory,
  legLoadOn,
  levelOf,
  mainCulprits,
} from '../src/logic/legLoad'
import { emptyExerciseState } from '../src/logic/progression'
import type { SessionLog } from '../src/types'
import { MON, baseState } from './helpers'

describe('wat voor beenwerk is het', () => {
  it('telt zwaar samengesteld beenwerk vol mee', () => {
    for (const id of ['leg_press', 'smith_squat', 'rdl_trapbar', 'hip_thrust_smith', 'walking_lunge_db']) {
      expect(legCategory(getExercise(id)), id).toBe('zwaar')
    }
  })

  it('telt beenisolatie licht mee', () => {
    for (const id of ['leg_curl', 'leg_extension', 'standing_calf_smith', 'seated_calf']) {
      expect(legCategory(getExercise(id)), id).toBe('licht')
    }
  })

  it('telt bovenlichaam en romp niet mee', () => {
    for (const id of ['bench_smith', 'lat_pulldown', 'triceps_pushdown', 'plank', 'dead_bug']) {
      expect(legCategory(getExercise(id)), id).toBe('geen')
    }
  })

  it('weegt isolatie duidelijk lichter dan samengesteld werk', () => {
    expect(CATEGORY_WEIGHT.licht).toBeLessThan(CATEGORY_WEIGHT.zwaar / 2)
    expect(CATEGORY_WEIGHT.geen).toBe(0)
  })
})

describe('hoe zwaar staat het gepland', () => {
  const s0 = baseState()

  it('rekent zonder historie met een vaste schatting', () => {
    expect(intensityFactor(s0, getExercise('leg_press'), false)).toBe(DEFAULT_INTENSITY)
  })

  it('rekent werk zonder kilo’s lichter', () => {
    expect(intensityFactor(s0, getExercise('step_up_bw'), false)).toBe(BODYWEIGHT_INTENSITY)
    expect(intensityFactor(s0, getExercise('band_lateral_walk'), false)).toBe(BODYWEIGHT_INTENSITY)
  })

  it('gebruikt het deel van je geschatte 1RM zodra dat te berekenen is', () => {
    // 100 kg × 10 reps geeft een geschat 1RM van ~133; een streefgewicht van 100 is dus ~0,75
    const state = baseState({
      sessions: log(100, 10),
      exerciseState: { leg_press: { ...emptyExerciseState(), targetWeight: 100, targetReps: 10 } },
    })
    const factor = intensityFactor(state, getExercise('leg_press'), false)
    expect(factor).toBeGreaterThan(0.7)
    expect(factor).toBeLessThan(0.8)
  })

  it('rekent een lichter streefgewicht ook lichter', () => {
    const zwaar = baseState({
      sessions: log(100, 10),
      exerciseState: { leg_press: { ...emptyExerciseState(), targetWeight: 100, targetReps: 10 } },
    })
    const licht = baseState({
      sessions: log(100, 10),
      exerciseState: { leg_press: { ...emptyExerciseState(), targetWeight: 60, targetReps: 10 } },
    })
    expect(intensityFactor(licht, getExercise('leg_press'), false)).toBeLessThan(
      intensityFactor(zwaar, getExercise('leg_press'), false),
    )
  })

  it('haalt de deloadkorting er meteen af', () => {
    const vol = intensityFactor(s0, getExercise('leg_press'), false)
    expect(intensityFactor(s0, getExercise('leg_press'), true)).toBeLessThan(vol)
  })
})

describe('de score van een sessie', () => {
  const s0 = baseState()

  it('vertaalt de score naar een niveau', () => {
    expect(levelOf(0)).toBe('geen')
    expect(levelOf(LEG_LOAD_HIGH - 0.01)).toBe('licht')
    expect(levelOf(LEG_LOAD_HIGH)).toBe('hoog')
    expect(levelOf(LEG_LOAD_VERY_HIGH)).toBe('zeer_hoog')
  })

  it('telt meer sets zwaarder', () => {
    const normaal = legLoadOn(s0, MON).score
    const laag = legLoadOn(baseState({ checkins: { [MON]: 1 } }), MON).score
    // een lage check-in haalt er een set per oefening af
    expect(laag).toBeLessThan(normaal)
  })

  it('noemt de zwaarste oefeningen als oorzaak', () => {
    const culprits = mainCulprits(legLoadOn(s0, MON))
    expect(culprits.length).toBeGreaterThan(0)
    expect(culprits.length).toBeLessThanOrEqual(3)
    expect(culprits).toContain('Leg press')
    // geen bandwerk in het rijtje oorzaken
    expect(culprits.join(' ')).not.toContain('mini-band')
  })

  it('geeft een lege dag een score van nul', () => {
    expect(legLoadOn(s0, '2026-08-05').score).toBe(0) // woensdag, rustdag
    expect(legLoadOn(s0, '2026-08-05').parts).toEqual([])
  })
})

function log(weight: number, reps: number): Record<string, SessionLog> {
  return {
    [`${MON}:legs_a`]: {
      date: MON,
      kind: 'legs_a',
      short: false,
      completedAt: `${MON}T18:00:00.000Z`,
      skippedSlots: [],
      completedSlots: [],
      exercises: { 'legs_a:0': 'leg_press' },
      entries: { 'legs_a:0': [{ weight, reps, rir: 1, done: true }] },
    },
  }
}
