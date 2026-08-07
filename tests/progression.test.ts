import { describe, expect, it } from 'vitest'
import { getExercise } from '../src/data/exercises'
import {
  CALIBRATION_TEXT,
  applyProgression,
  emptyExerciseState,
  estimate1RM,
  roundTo,
  targetFor,
} from '../src/logic/progression'
import { baseState } from './helpers'

const legPress = getExercise('leg_press') // progression 'weight', stap 1,25 kg
const dbPress = getExercise('db_shoulder_press') // progression 'reps', stap 2,5 kg
const s0 = baseState()

const sets = (n: number, weight: number, reps: number, rir: number) =>
  Array.from({ length: n }, () => ({ weight, reps, rir }))

describe('streefwaarden', () => {
  it('toont in de kalibratieweken geen gewicht maar een instructie', () => {
    const t = targetFor(legPress, 8, s0, { calibration: true, deload: false })
    expect(t.byFeel).toBe(true)
    expect(t.note).toBe(CALIBRATION_TEXT)
    expect(t.weight).toBeNull()
  })

  it('valt terug op gevoel zolang er nog niets gelogd is', () => {
    expect(targetFor(legPress, 8, s0, { calibration: false, deload: false }).byFeel).toBe(true)
  })

  it('toont een streefgewicht zodra er data is', () => {
    const state = baseState({
      exerciseState: { leg_press: { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 } },
    })
    const t = targetFor(legPress, 8, state, { calibration: false, deload: false })
    expect(t.byFeel).toBe(false)
    expect(t.weight).toBe(100)
  })

  it('haalt in de deloadweek 10% van het streefgewicht af', () => {
    const state = baseState({
      exerciseState: { leg_press: { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 } },
    })
    expect(targetFor(legPress, 8, state, { calibration: false, deload: true }).weight).toBe(90)
  })
})

describe('progressie op gewicht', () => {
  const base = { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 }

  it('verhoogt met de kleinste stap bij alle sets op de bovengrens met RIR <= 2', () => {
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(3, 100, 10, 1), base, {
      allowIncrease: true,
    })
    expect(r.next.targetWeight).toBe(101.25)
    expect(r.next.targetReps).toBe(8)
    expect(r.message).toContain('omhoog')
  })

  it('verhoogt niet bij RIR 3', () => {
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(3, 100, 10, 3), base, {
      allowIncrease: true,
    })
    expect(r.next.targetWeight).toBe(100)
  })

  it('verhoogt niet als één set de bovengrens niet haalt', () => {
    const mixed = [...sets(2, 100, 10, 1), { weight: 100, reps: 9, rir: 1 }]
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, mixed, base, { allowIncrease: true })
    expect(r.next.targetWeight).toBe(100)
  })

  it('verhoogt niet als de check-in op 3 stond', () => {
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(3, 100, 10, 1), base, {
      allowIncrease: false,
    })
    expect(r.next.targetWeight).toBe(100)
    expect(r.next.lastNote).toContain('geen nieuwe gewichtsverhoging')
  })
})

describe('progressie op reps', () => {
  it('groeit eerst door tot repMax + 2', () => {
    const start = { ...emptyExerciseState(), targetWeight: 15, targetReps: 12 }
    const r = applyProgression(dbPress, { repMin: 8, repMax: 12 }, sets(1, 15, 12, 1), start, {
      allowIncrease: true,
    })
    expect(r.next.targetReps).toBe(13)
    expect(r.next.targetWeight).toBe(15)
  })

  it('gaat pas daarna omhoog in gewicht en terug naar de ondergrens', () => {
    const start = { ...emptyExerciseState(), targetWeight: 15, targetReps: 14 }
    const r = applyProgression(dbPress, { repMin: 8, repMax: 12 }, sets(1, 15, 14, 1), start, {
      allowIncrease: true,
    })
    expect(r.next.targetWeight).toBe(17.5)
    expect(r.next.targetReps).toBe(8)
  })
})

describe('terugschakelen', () => {
  const base = { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 }

  it('verlaagt nog niet na één sessie onder de ondergrens', () => {
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(1, 100, 6, 0), base, {
      allowIncrease: true,
    })
    expect(r.next.targetWeight).toBe(100)
    expect(r.next.belowMinStreak).toBe(1)
  })

  it('verlaagt met 5% na twee sessies onder de ondergrens en meldt dat', () => {
    const eerste = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(1, 100, 6, 0), base, {
      allowIncrease: true,
    })
    const tweede = applyProgression(
      legPress,
      { repMin: 8, repMax: 10 },
      sets(1, 100, 6, 0),
      eerste.next,
      { allowIncrease: true },
    )
    expect(tweede.next.targetWeight).toBe(95)
    expect(tweede.next.belowMinStreak).toBe(0)
    expect(tweede.message).toContain('5%')
  })

  it('zet de teller terug zodra de ondergrens weer gehaald wordt', () => {
    const eerste = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(1, 100, 6, 0), base, {
      allowIncrease: true,
    })
    const herstel = applyProgression(
      legPress,
      { repMin: 8, repMax: 10 },
      sets(1, 100, 9, 1),
      eerste.next,
      { allowIncrease: true },
    )
    expect(herstel.next.belowMinStreak).toBe(0)
  })

  it('negeert lege sets', () => {
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(3, 0, 0, 2), base, {
      allowIncrease: true,
    })
    expect(r.next).toEqual(base)
  })
})

describe('rekenhulpjes', () => {
  it('rondt af op de kleinste stap', () => {
    expect(roundTo(101.3, 1.25)).toBe(101.25)
    expect(roundTo(16.4, 2.5)).toBe(17.5)
  })

  it('schat 1RM volgens Epley', () => {
    expect(estimate1RM(100, 10)).toBeCloseTo(133.3, 1)
    expect(estimate1RM(0, 10)).toBe(0)
    expect(estimate1RM(100, 0)).toBe(0)
  })
})
