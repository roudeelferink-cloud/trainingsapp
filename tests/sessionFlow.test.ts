import { describe, expect, it } from 'vitest'
import { getExercise } from '../src/data/exercises'
import { targetFor } from '../src/logic/progression'
import {
  allSetsDone,
  checkSet,
  nextUncompleted,
  seedSets,
  toggleCompleted,
  uncheckSet,
} from '../src/logic/sessionFlow'
import { startWeightAdvice } from '../src/logic/startWeight'
import type { LoggedSet } from '../src/types'
import { baseState } from './helpers'

const ex = getExercise('leg_press')
const opts = { calibration: false, deload: false }

describe('voorvullen van sets', () => {
  it('vult alle sets met de streefwaarden uit eerdere sessies', () => {
    const state = baseState({
      exerciseState: {
        leg_press: {
          targetWeight: 100,
          targetReps: 9,
          belowMinStreak: 0,
          lastNote: null,
          lastUpdated: '2026-08-01T18:00:00.000Z',
        },
      },
    })
    // met historie geeft het startgewichtadvies niets meer; de progressie is leidend
    expect(startWeightAdvice(ex, state)).toBeNull()

    const sets = seedSets(3, targetFor(ex, ex.setsReps.repMin, state, opts), startWeightAdvice(ex, state))
    expect(sets).toHaveLength(3)
    for (const s of sets) {
      expect(s).toEqual({ weight: 100, reps: 9, rir: 2, done: false })
    }
  })

  it('valt zonder eerdere sessie terug op het gewichtsadvies met schema-reps', () => {
    const state = baseState()
    state.settings.bodyweightKg = 82
    const advice = startWeightAdvice(ex, state)
    expect(advice).toMatchObject({ weight: 40, source: 'bodyweight' }) // 82 × 0,5, afgerond op de stap

    const sets = seedSets(2, targetFor(ex, ex.setsReps.repMin, state, opts), advice)
    expect(sets[0]).toEqual({ weight: 40, reps: ex.setsReps.repMin, rir: 2, done: false })
  })

  it('laat zonder historie én zonder advies het gewicht leeg, met schema-reps', () => {
    const state = baseState() // geen lichaamsgewicht, dus ook geen advies
    expect(startWeightAdvice(ex, state)).toBeNull()

    const sets = seedSets(2, targetFor(ex, ex.setsReps.repMin, state, opts), null)
    expect(sets[0]).toEqual({ weight: 0, reps: ex.setsReps.repMin, rir: 2, done: false })
  })

  it('telt een voorgevulde set niet als afgevinkt', () => {
    const state = baseState({
      exerciseState: {
        leg_press: {
          targetWeight: 100,
          targetReps: 9,
          belowMinStreak: 0,
          lastNote: null,
          lastUpdated: '2026-08-01T18:00:00.000Z',
        },
      },
    })
    const sets = seedSets(3, targetFor(ex, ex.setsReps.repMin, state, opts), null)
    expect(allSetsDone(sets)).toBe(false)
    expect(sets.filter((s) => s.done)).toHaveLength(0)
  })
})

describe('sets afvinken', () => {
  const fresh = (): LoggedSet[] => [
    { weight: 40, reps: 8, rir: 2, done: false },
    { weight: 40, reps: 8, rir: 2, done: false },
    { weight: 40, reps: 8, rir: 2, done: false },
  ]

  it('neemt bij het afvinken de waarden over in de direct volgende set', () => {
    const sets = fresh()
    sets[0] = { weight: 42.5, reps: 9, rir: 1, done: false } // bijgesteld vóór het afvinken

    const out = checkSet(sets, 0)
    expect(out[0]).toEqual({ weight: 42.5, reps: 9, rir: 1, done: true })
    expect(out[1]).toEqual({ weight: 42.5, reps: 9, rir: 1, done: false })
    // alleen de direct volgende set, niet verder vooruit
    expect(out[2]).toEqual({ weight: 40, reps: 8, rir: 2, done: false })
  })

  it('overschrijft een al afgevinkte volgende set niet', () => {
    const sets = fresh()
    sets[1] = { weight: 50, reps: 6, rir: 0, done: true }
    const out = checkSet(sets, 0)
    expect(out[1]).toEqual({ weight: 50, reps: 6, rir: 0, done: true })
  })

  it('zet een set weer open zonder de waarden aan te passen', () => {
    const out = uncheckSet(checkSet(fresh(), 0), 0)
    expect(out[0]).toEqual({ weight: 40, reps: 8, rir: 2, done: false })
  })

  it('herkent wanneer alle sets afgevinkt zijn', () => {
    let sets = fresh()
    expect(allSetsDone(sets)).toBe(false)
    sets = checkSet(checkSet(checkSet(sets, 0), 1), 2)
    expect(allSetsDone(sets)).toBe(true)
    expect(allSetsDone([])).toBe(false)
  })
})

describe('afronden per oefening', () => {
  const keys = ['a', 'b', 'c']

  it('gaat na afronden naar de volgende niet-afgeronde oefening', () => {
    expect(nextUncompleted(keys, ['a'], 'a')).toBe('b')
    expect(nextUncompleted(keys, ['a', 'b'], 'b')).toBe('c')
  })

  it('loopt door naar het begin als de volgende al afgerond is', () => {
    expect(nextUncompleted(keys, ['b', 'c'], 'c')).toBe('a')
  })

  it('geeft null als alles afgerond is', () => {
    expect(nextUncompleted(keys, keys, 'c')).toBeNull()
  })

  it('kan een oefening afronden en weer terugzetten', () => {
    const once = toggleCompleted([], 'a')
    expect(once).toEqual(['a'])
    expect(toggleCompleted(once, 'a')).toEqual([])
  })
})
